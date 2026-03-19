package utils

import (
	"fmt"
	"io"
	"strings"
	"time"

	fhttp "github.com/bogdanfinn/fhttp"
	tls_client "github.com/bogdanfinn/tls-client"
	"github.com/bogdanfinn/tls-client/profiles"
)

// TLSClient wraps a tls-client for browser-like HTTP requests
type TLSClient struct {
	client tls_client.HttpClient
}

// NewTLSClient creates a new TLS client with Chrome browser profile
func NewTLSClient() (*TLSClient, error) {
	jar := tls_client.NewCookieJar()
	options := []tls_client.HttpClientOption{
		tls_client.WithTimeoutSeconds(30),
		tls_client.WithClientProfile(profiles.Chrome_131),
		tls_client.WithNotFollowRedirects(),
		tls_client.WithCookieJar(jar),
	}

	client, err := tls_client.NewHttpClient(tls_client.NewNoopLogger(), options...)
	if err != nil {
		return nil, fmt.Errorf("failed to create TLS client: %w", err)
	}

	return &TLSClient{client: client}, nil
}

// Post sends a POST request with form data
func (c *TLSClient) Post(url string, formData string, headers map[string]string) ([]byte, int, error) {
	req, err := fhttp.NewRequest(fhttp.MethodPost, url, strings.NewReader(formData))
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create request: %w", err)
	}

	// Set default headers
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

	// Apply custom headers
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response: %w", err)
	}

	return body, resp.StatusCode, nil
}

// Get sends a GET request
func (c *TLSClient) Get(url string, headers map[string]string) ([]byte, int, error) {
	req, err := fhttp.NewRequest(fhttp.MethodGet, url, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create request: %w", err)
	}

	// Set default headers
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

	// Apply custom headers
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("failed to read response: %w", err)
	}

	return body, resp.StatusCode, nil
}

// GlobalTLSClient is a shared TLS client instance
var globalTLSClient *TLSClient
var globalTLSClientInitTime time.Time

// GetTLSClient returns the global TLS client, creating one if needed
// The client is recreated every 5 minutes to refresh session
func GetTLSClient() (*TLSClient, error) {
	if globalTLSClient == nil || time.Since(globalTLSClientInitTime) > 5*time.Minute {
		var err error
		globalTLSClient, err = NewTLSClient()
		if err != nil {
			return nil, err
		}
		globalTLSClientInitTime = time.Now()
	}
	return globalTLSClient, nil
}
