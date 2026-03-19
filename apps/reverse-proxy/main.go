package main

import (
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/joho/godotenv"
)

// ---- In-Memory Static File Cache ----

type CachedFile struct {
	Content     []byte
	ContentType string
	ModTime     time.Time
}

type FileCache struct {
	mu    sync.RWMutex
	files map[string]*CachedFile
}

func NewFileCache() *FileCache {
	return &FileCache{files: make(map[string]*CachedFile)}
}

func (fc *FileCache) Get(path string) (*CachedFile, bool) {
	fc.mu.RLock()
	defer fc.mu.RUnlock()
	f, ok := fc.files[path]
	return f, ok
}

func (fc *FileCache) Set(path string, file *CachedFile) {
	fc.mu.Lock()
	defer fc.mu.Unlock()
	fc.files[path] = file
}

func (fc *FileCache) Delete(path string) {
	fc.mu.Lock()
	defer fc.mu.Unlock()
	delete(fc.files, path)
}

func (fc *FileCache) Clear() {
	fc.mu.Lock()
	defer fc.mu.Unlock()
	fc.files = make(map[string]*CachedFile)
}

// ---- Main ----

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "7777"
	}

	backendURL := os.Getenv("BACKEND_URL")
	if backendURL == "" {
		backendURL = "http://localhost:3001"
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	staticDir := os.Getenv("STATIC_DIR")
	publicAPIURL := os.Getenv("PUBLIC_API_URL")

	// Parse backend URL for reverse proxy
	backend, err := url.Parse(backendURL)
	if err != nil {
		log.Fatalf("Invalid BACKEND_URL: %v", err)
	}

	// Create backend reverse proxy
	backendProxy := httputil.NewSingleHostReverseProxy(backend)

	// Determine frontend mode
	var frontendHandler http.Handler
	if staticDir != "" {
		log.Printf("Static mode: serving files from %s", staticDir)
		frontendHandler = createStaticHandler(staticDir, publicAPIURL)
	} else if frontendURL != "" {
		log.Printf("Proxy mode: forwarding to %s", frontendURL)
		frontendTarget, err := url.Parse(frontendURL)
		if err != nil {
			log.Fatalf("Invalid FRONTEND_URL: %v", err)
		}
		frontendHandler = createProxyHandler(frontendTarget)
	} else {
		log.Fatal("Either FRONTEND_URL or STATIC_DIR must be set")
	}

	mux := http.NewServeMux()

	// Route /api/* to backend
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		backendProxy.ServeHTTP(w, r)
	})

	// Route everything else to frontend
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		frontendHandler.ServeHTTP(w, r)
	})

	log.Printf("Reverse proxy starting on :%s", port)
	log.Printf("  /api/* -> %s", backendURL)
	if staticDir != "" {
		log.Printf("  /*     -> static files from %s", staticDir)
	} else {
		log.Printf("  /*     -> %s", frontendURL)
	}

	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

// createStaticHandler creates a handler that serves static files with in-memory caching
func createStaticHandler(staticDir, publicAPIURL string) http.Handler {
	cache := NewFileCache()

	// Pre-load files into cache
	loadFilesIntoCache(staticDir, cache)

	// Start file watcher for cache invalidation
	go watchFiles(staticDir, cache)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "/" {
			path = "/index.html"
		}

		// Try to serve from cache
		if cached, ok := cache.Get(path); ok {
			content := cached.Content

			// Inject runtime config into index.html
			if path == "/index.html" && publicAPIURL != "" {
				content = injectRuntimeConfig(content, publicAPIURL)
			}

			w.Header().Set("Content-Type", cached.ContentType)
			if path != "/index.html" {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else {
				w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			}
			w.Write(content)
			return
		}

		// Fallback to index.html for SPA routing
		if cached, ok := cache.Get("/index.html"); ok {
			content := cached.Content
			if publicAPIURL != "" {
				content = injectRuntimeConfig(content, publicAPIURL)
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Write(content)
			return
		}

		http.NotFound(w, r)
	})
}

// loadFilesIntoCache recursively loads all files from a directory into cache
func loadFilesIntoCache(dir string, cache *FileCache) {
	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			log.Printf("Failed to read file %s: %v", path, err)
			return nil
		}

		relativePath := "/" + strings.TrimPrefix(filepath.ToSlash(strings.TrimPrefix(path, dir)), "/")
		contentType := mime.TypeByExtension(filepath.Ext(path))
		if contentType == "" {
			contentType = "application/octet-stream"
		}

		cache.Set(relativePath, &CachedFile{
			Content:     content,
			ContentType: contentType,
			ModTime:     info.ModTime(),
		})

		return nil
	})

	log.Printf("Loaded static files into cache")
}

// watchFiles watches the static directory and invalidates cache on changes
func watchFiles(dir string, cache *FileCache) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Printf("Failed to create file watcher: %v", err)
		return
	}
	defer watcher.Close()

	// Add all directories to watcher
	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			watcher.Add(path)
		}
		return nil
	})

	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}
			if event.Has(fsnotify.Write) || event.Has(fsnotify.Create) || event.Has(fsnotify.Remove) {
				log.Printf("File change detected: %s, reloading cache...", event.Name)
				cache.Clear()
				loadFilesIntoCache(dir, cache)
			}
		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			log.Printf("Watcher error: %v", err)
		}
	}
}

// injectRuntimeConfig injects window.__RUNTIME_CONFIG__ into index.html
func injectRuntimeConfig(content []byte, apiURL string) []byte {
	script := fmt.Sprintf(`<script>window.__RUNTIME_CONFIG__={API_URL:"%s"}</script>`, apiURL)
	html := string(content)
	html = strings.Replace(html, "</head>", script+"</head>", 1)
	return []byte(html)
}

// createProxyHandler creates a proxy handler for frontend dev server
func createProxyHandler(target *url.URL) http.Handler {
	proxy := httputil.NewSingleHostReverseProxy(target)

	// Health check for dev server
	go func() {
		for {
			resp, err := http.Get(target.String())
			if err != nil || resp.StatusCode != 200 {
				log.Printf("Frontend dev server at %s is not ready...", target.String())
			} else {
				resp.Body.Close()
				log.Printf("Frontend dev server at %s is ready", target.String())
				return
			}
			time.Sleep(2 * time.Second)
		}
	}()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if frontend is available
		resp, err := http.Get(target.String())
		if err != nil || resp.StatusCode >= 500 {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusServiceUnavailable)
			io.WriteString(w, `<!DOCTYPE html>
<html><head><title>Frontend Restarting...</title>
<meta http-equiv="refresh" content="3">
<style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;font-family:sans-serif;background:#f1f5f9;color:#334155;}
.box{text-align:center;padding:3rem;background:white;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.1);}
h1{margin:0 0 1rem;font-size:1.5rem;}p{margin:0;color:#64748b;}</style></head>
<body><div class="box"><h1>🔄 Frontend is restarting...</h1><p>This page will auto-refresh in 3 seconds.</p></div></body></html>`)
			return
		}
		if resp != nil {
			resp.Body.Close()
		}

		proxy.ServeHTTP(w, r)
	})
}
