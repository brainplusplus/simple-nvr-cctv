package services

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"simple-nvr-cctv/internal/models"
)

type CameraLookupRepository interface {
	Get(ctx context.Context, id string) (*models.Camera, error)
}

type RecordingServiceConfig struct {
	RecordingsRoot      string
	FFmpegBinary        string
	SnapshotTTL         time.Duration
	SnapshotTimeout     time.Duration
	LiveRoot            string
	LiveSegmentTime     int
	LivePlaylistSize    int
	LiveStartupTimeout  time.Duration
	LiveIdleTimeout     time.Duration
	LiveCleanupInterval time.Duration
	Logger              *log.Logger
	Now                 func() time.Time
}

type RecordingService struct {
	cfg        RecordingServiceConfig
	cameraRepo CameraLookupRepository
	mu         sync.RWMutex
	cache      map[string]cachedSnapshot
	live       map[string]*liveSession
}

type cachedSnapshot struct {
	result    models.SnapshotResult
	expiresAt time.Time
}

func NewRecordingService(cfg RecordingServiceConfig, cameraRepo CameraLookupRepository) *RecordingService {
	if cfg.RecordingsRoot == "" {
		cfg.RecordingsRoot = "recordings"
	}
	if cfg.FFmpegBinary == "" {
		cfg.FFmpegBinary = os.Getenv("FFMPEG_BIN")
		if cfg.FFmpegBinary == "" {
			cfg.FFmpegBinary = "ffmpeg"
		}
	}
	if cfg.SnapshotTTL <= 0 {
		cfg.SnapshotTTL = 60 * time.Second
	}
	if cfg.SnapshotTimeout <= 0 {
		cfg.SnapshotTimeout = 10 * time.Second
	}
	if cfg.LiveRoot == "" {
		cfg.LiveRoot = filepath.Join(cfg.RecordingsRoot, ".live")
	}
	if cfg.LiveSegmentTime <= 0 {
		cfg.LiveSegmentTime = 2
	}
	if cfg.LivePlaylistSize <= 0 {
		cfg.LivePlaylistSize = 6
	}
	if cfg.LiveStartupTimeout <= 0 {
		cfg.LiveStartupTimeout = 15 * time.Second
	}
	if cfg.LiveIdleTimeout <= 0 {
		cfg.LiveIdleTimeout = 45 * time.Second
	}
	if cfg.LiveCleanupInterval <= 0 {
		cfg.LiveCleanupInterval = 10 * time.Second
	}
	if cfg.Logger == nil {
		cfg.Logger = log.Default()
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	service := &RecordingService{cfg: cfg, cameraRepo: cameraRepo, cache: make(map[string]cachedSnapshot), live: make(map[string]*liveSession)}
	go service.runLiveCleanupLoop()
	return service
}

func (s *RecordingService) List(ctx context.Context, cameraID string) ([]models.RecordingFile, error) {
	root := filepath.Join(s.cfg.RecordingsRoot, cameraID)
	files := make([]models.RecordingFile, 0)
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || filepath.Ext(path) != ".mp4" {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)
		files = append(files, models.RecordingFile{
			CameraID:     cameraID,
			Filename:     filepath.Base(path),
			RelativePath: rel,
			PlaybackURL:  fmt.Sprintf("/api/recordings/file?camera_id=%s&path=%s", url.QueryEscape(cameraID), url.QueryEscape(rel)),
			Timestamp:    parseRecordingTimestamp(rel, info.ModTime().UTC()),
			Size:         info.Size(),
		})
		return nil
	})
	if os.IsNotExist(err) {
		return files, nil
	}
	if err != nil {
		return nil, err
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Timestamp.After(files[j].Timestamp) })
	return files, nil
}

func (s *RecordingService) OpenFile(ctx context.Context, cameraID, relativePath string) (*os.File, fs.FileInfo, string, error) {
	clean, err := validateRelativeRecordingPath(relativePath)
	if err != nil {
		return nil, nil, "", err
	}
	fullPath := filepath.Join(s.cfg.RecordingsRoot, cameraID, filepath.FromSlash(clean))
	file, err := os.Open(fullPath)
	if err != nil {
		return nil, nil, "", err
	}
	info, err := file.Stat()
	if err != nil {
		file.Close()
		return nil, nil, "", err
	}
	return file, info, fullPath, nil
}

func (s *RecordingService) Delete(ctx context.Context, cameraID string, relativePaths []string) (int, error) {
	deleted := 0
	for _, relativePath := range relativePaths {
		clean, err := validateRelativeRecordingPath(relativePath)
		if err != nil {
			return deleted, err
		}

		fullPath := filepath.Join(s.cfg.RecordingsRoot, cameraID, filepath.FromSlash(clean))
		if err := os.Remove(fullPath); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			return deleted, err
		}
		deleted++
	}

	return deleted, nil
}

func (s *RecordingService) GetSnapshot(ctx context.Context, cameraID string) (*models.SnapshotResult, error) {
	if cached, ok := s.getCachedSnapshot(cameraID); ok {
		return &cached, nil
	}
	if s.cameraRepo == nil {
		return nil, errors.New("camera repository is not configured")
	}
	camera, err := s.cameraRepo.Get(ctx, cameraID)
	if err != nil {
		return nil, err
	}
	content, err := s.captureSnapshotFromRTSP(ctx, camera.RTSPURL)
	if err != nil {
		if cached, ok := s.getAnyCachedSnapshot(cameraID); ok {
			return &cached, nil
		}

		recordings, listErr := s.List(ctx, cameraID)
		if listErr == nil {
			for _, recording := range recordings {
				filePath := filepath.Join(s.cfg.RecordingsRoot, cameraID, filepath.FromSlash(recording.RelativePath))
				fallbackContent, fallbackErr := s.captureSnapshotFromFile(ctx, filePath)
				if fallbackErr == nil {
					s.cacheSnapshot(cameraID, fallbackContent, "image/jpeg")
					result, _ := s.getCachedSnapshot(cameraID)
					return &result, nil
				}
			}
		}

		return nil, err
	}
	s.cacheSnapshot(cameraID, content, "image/jpeg")
	result, _ := s.getCachedSnapshot(cameraID)
	return &result, nil
}

func (s *RecordingService) captureSnapshotFromRTSP(ctx context.Context, rtspURL string) ([]byte, error) {
	return s.captureSnapshot(ctx, []string{
		"-rtsp_transport", "tcp",
		"-analyzeduration", "10000000",
		"-probesize", "10000000",
		"-i", rtspURL,
	})
}

func (s *RecordingService) captureSnapshotFromFile(ctx context.Context, filePath string) ([]byte, error) {
	return s.captureSnapshot(ctx, []string{"-i", filePath})
}

func (s *RecordingService) captureSnapshot(ctx context.Context, inputArgs []string) ([]byte, error) {
	timedCtx, cancel := context.WithTimeout(ctx, s.cfg.SnapshotTimeout)
	defer cancel()

	args := append([]string{"-hide_banner", "-loglevel", "error"}, inputArgs...)
	args = append(args,
		"-frames:v", "1",
		"-f", "image2pipe",
		"-vcodec", "mjpeg",
		"-",
	)

	cmd := exec.CommandContext(timedCtx, s.cfg.FFmpegBinary, args...)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if stderr.Len() > 0 {
			return nil, fmt.Errorf("snapshot capture failed: %s", strings.TrimSpace(stderr.String()))
		}
		return nil, err
	}

	return stdout.Bytes(), nil
}

func (s *RecordingService) cacheSnapshot(cameraID string, content []byte, contentType string) {
	now := s.cfg.Now().UTC()
	s.mu.Lock()
	s.cache[cameraID] = cachedSnapshot{
		result:    models.SnapshotResult{Content: append([]byte(nil), content...), ContentType: contentType, GeneratedAt: now},
		expiresAt: now.Add(s.cfg.SnapshotTTL),
	}
	s.mu.Unlock()
}

func (s *RecordingService) getCachedSnapshot(cameraID string) (models.SnapshotResult, bool) {
	now := s.cfg.Now().UTC()
	s.mu.RLock()
	entry, ok := s.cache[cameraID]
	s.mu.RUnlock()
	if !ok || now.After(entry.expiresAt) {
		return models.SnapshotResult{}, false
	}
	return entry.result, true
}

func (s *RecordingService) getAnyCachedSnapshot(cameraID string) (models.SnapshotResult, bool) {
	s.mu.RLock()
	entry, ok := s.cache[cameraID]
	s.mu.RUnlock()
	if !ok {
		return models.SnapshotResult{}, false
	}
	return entry.result, true
}

func validateRelativeRecordingPath(path string) (string, error) {
	if path == "" {
		return "", errors.New("recording path is required")
	}
	clean := filepath.ToSlash(filepath.Clean(filepath.FromSlash(path)))
	if strings.HasPrefix(clean, "../") || clean == ".." || filepath.IsAbs(clean) {
		return "", errors.New("invalid recording path")
	}
	return clean, nil
}

func parseRecordingTimestamp(relativePath string, fallback time.Time) time.Time {
	rel := strings.TrimSuffix(filepath.ToSlash(relativePath), ".mp4")
	parts := strings.Split(rel, "/")
	if len(parts) == 0 {
		return fallback
	}
	filename := parts[len(parts)-1]
	if ts, err := time.ParseInLocation("20060102_150405", filename, time.UTC); err == nil {
		return ts.UTC()
	}
	if ts, err := time.ParseInLocation("20060102_1504", filename, time.UTC); err == nil {
		return ts.UTC()
	}
	if len(parts) >= 4 {
		ts, err := time.ParseInLocation("2006/01/02/150405", strings.Join(parts[len(parts)-4:], "/"), time.UTC)
		if err == nil {
			return ts.UTC()
		}
	}
	return fallback
}
