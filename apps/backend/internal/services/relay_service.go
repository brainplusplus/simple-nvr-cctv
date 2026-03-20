package services

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"simple-nvr-cctv/internal/models"
)

type RelayManager interface {
	SyncCamera(ctx context.Context, camera models.Camera) error
	RemoveCamera(ctx context.Context, cameraID string) error
	RTSPURL(cameraID string) string
	BrowserStreamName(cameraID string) string
}

type Go2RTCRelayConfig struct {
	APIURL       string
	RTSPURL      string
	StreamPrefix string
	Timeout      time.Duration
	HTTPClient   *http.Client
}

type Go2RTCRelayManager struct {
	cfg Go2RTCRelayConfig
}

func NewGo2RTCRelayManager(cfg Go2RTCRelayConfig) *Go2RTCRelayManager {
	if cfg.StreamPrefix == "" {
		cfg.StreamPrefix = "camera_"
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 15 * time.Second
	}
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = &http.Client{Timeout: cfg.Timeout}
	}
	return &Go2RTCRelayManager{cfg: cfg}
}

func (m *Go2RTCRelayManager) Enabled() bool {
	return m != nil && m.cfg.APIURL != "" && m.cfg.RTSPURL != ""
}

func (m *Go2RTCRelayManager) SyncCamera(ctx context.Context, camera models.Camera) error {
	if !m.Enabled() {
		return nil
	}

	streamName := m.streamName(camera.ID)
	params := url.Values{}
	params.Set("name", streamName)
	params.Set("src", camera.RTSPURL)

	method := http.MethodPut
	if err := m.request(ctx, method, "/api/streams", params); err != nil {
		params.Del("name")
		params.Set("src", streamName)
		_ = m.request(ctx, http.MethodDelete, "/api/preload", params)
		params.Set("name", streamName)
		return err
	}

	preload := url.Values{}
	preload.Set("src", streamName)
	if camera.Enabled {
		if err := m.request(ctx, http.MethodPut, "/api/preload", preload); err != nil {
			return err
		}
	} else {
		_ = m.request(ctx, http.MethodDelete, "/api/preload", preload)
	}

	browser := url.Values{}
	browser.Set("name", m.browserStreamName(camera.ID))
	browser.Set("src", fmt.Sprintf("ffmpeg:%s#video=h264#audio=aac", streamName))
	if err := m.request(ctx, http.MethodPut, "/api/streams", browser); err != nil {
		return err
	}

	return nil
}

func (m *Go2RTCRelayManager) RemoveCamera(ctx context.Context, cameraID string) error {
	if !m.Enabled() {
		return nil
	}

	streamName := m.streamName(cameraID)
	params := url.Values{}
	params.Set("src", streamName)
	browser := url.Values{}
	browser.Set("src", m.browserStreamName(cameraID))
	_ = m.request(ctx, http.MethodDelete, "/api/streams", browser)
	_ = m.request(ctx, http.MethodDelete, "/api/preload", params)
	return m.request(ctx, http.MethodDelete, "/api/streams", params)
}

func (m *Go2RTCRelayManager) RTSPURL(cameraID string) string {
	if !m.Enabled() {
		return ""
	}
	return fmt.Sprintf("%s/%s?mp4", trimTrailingSlash(m.cfg.RTSPURL), m.streamName(cameraID))
}

func (m *Go2RTCRelayManager) BrowserStreamName(cameraID string) string {
	if !m.Enabled() {
		return ""
	}
	return m.browserStreamName(cameraID)
}

func (m *Go2RTCRelayManager) streamName(cameraID string) string {
	return m.cfg.StreamPrefix + cameraID
}

func (m *Go2RTCRelayManager) browserStreamName(cameraID string) string {
	return m.streamName(cameraID) + "_browser"
}

func (m *Go2RTCRelayManager) request(ctx context.Context, method, path string, params url.Values) error {
	req, err := http.NewRequestWithContext(ctx, method, trimTrailingSlash(m.cfg.APIURL)+path+"?"+params.Encode(), nil)
	if err != nil {
		return err
	}

	resp, err := m.cfg.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	body, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("go2rtc %s %s failed: %s", method, path, string(body))
}

func trimTrailingSlash(value string) string {
	for len(value) > 0 && value[len(value)-1] == '/' {
		value = value[:len(value)-1]
	}
	return value
}
