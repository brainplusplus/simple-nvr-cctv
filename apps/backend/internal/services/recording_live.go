package services

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"mime"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"simple-nvr-cctv/internal/models"
)

type liveSession struct {
	process      ManagedProcess
	cancel       context.CancelFunc
	lastAccessAt time.Time
}

func (s *RecordingService) OpenLiveFile(ctx context.Context, cameraID, asset string) (*os.File, fs.FileInfo, string, string, error) {
	cleanAsset, err := validateLiveAssetPath(asset)
	if err != nil {
		return nil, nil, "", "", err
	}

	if err := s.ensureLiveSession(ctx, cameraID); err != nil {
		return nil, nil, "", "", err
	}

	fullPath := filepath.Join(s.cfg.LiveRoot, cameraID, filepath.FromSlash(cleanAsset))
	if err := s.waitForLiveAsset(ctx, fullPath); err != nil {
		return nil, nil, "", "", err
	}

	file, err := os.Open(fullPath)
	if err != nil {
		return nil, nil, "", "", err
	}
	info, err := file.Stat()
	if err != nil {
		file.Close()
		return nil, nil, "", "", err
	}

	s.touchLiveSession(cameraID)
	return file, info, fullPath, detectLiveContentType(fullPath), nil
}

func (s *RecordingService) ensureLiveSession(ctx context.Context, cameraID string) error {
	now := s.cfg.Now().UTC()

	s.mu.Lock()
	if session, ok := s.live[cameraID]; ok && session.process != nil {
		session.lastAccessAt = now
		s.mu.Unlock()
		return nil
	}
	s.mu.Unlock()

	if s.cameraRepo == nil {
		return errors.New("camera repository is not configured")
	}

	camera, err := s.cameraRepo.Get(ctx, cameraID)
	if err != nil {
		return err
	}
	if s.relay != nil {
		if err := s.relay.SyncCamera(ctx, *camera); err != nil {
			return err
		}
		if relayURL := s.relay.RTSPURL(camera.ID); relayURL != "" {
			camera.RTSPURL = relayURL
		}
	}

	streamDir := filepath.Join(s.cfg.LiveRoot, cameraID)
	if err := os.RemoveAll(streamDir); err != nil {
		return err
	}
	if err := os.MkdirAll(streamDir, 0o755); err != nil {
		return err
	}

	process, cancel, err := s.startLiveProcess(*camera, streamDir)
	if err != nil {
		return err
	}

	s.mu.Lock()
	if existing, ok := s.live[cameraID]; ok && existing.process != nil {
		s.mu.Unlock()
		cancel()
		_ = process.Stop(2 * time.Second)
		return nil
	}
	s.live[cameraID] = &liveSession{process: process, cancel: cancel, lastAccessAt: now}
	s.mu.Unlock()

	go s.waitForLiveExit(cameraID, process)
	return nil
}

func (s *RecordingService) startLiveProcess(camera models.Camera, streamDir string) (ManagedProcess, context.CancelFunc, error) {
	ctx, cancel := context.WithCancel(context.Background())
	playlistPath := filepath.Join(streamDir, "index.m3u8")
	segmentPattern := filepath.Join(streamDir, "segment_%05d.ts")

	args := []string{
		"-hide_banner",
		"-loglevel", "warning",
		"-rtsp_transport", "tcp",
		"-analyzeduration", "10000000",
		"-probesize", "10000000",
		"-i", camera.RTSPURL,
		"-map", "0:v:0",
		"-map", "0:a:0?",
		"-c:v", "libx264",
		"-preset", "ultrafast",
		"-tune", "zerolatency",
		"-pix_fmt", "yuv420p",
		"-profile:v", "baseline",
		"-level", "3.1",
		"-g", "48",
		"-keyint_min", "48",
		"-sc_threshold", "0",
		"-c:a", "aac",
		"-b:a", "128k",
		"-ac", "2",
		"-ar", "44100",
		"-f", "hls",
		"-hls_time", fmt.Sprintf("%d", s.cfg.LiveSegmentTime),
		"-hls_list_size", fmt.Sprintf("%d", s.cfg.LivePlaylistSize),
		"-hls_flags", "delete_segments+append_list+omit_endlist+independent_segments",
		"-hls_allow_cache", "0",
		"-hls_segment_filename", segmentPattern,
		playlistPath,
	}

	cmd := exec.CommandContext(ctx, s.cfg.FFmpegBinary, args...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return nil, nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return nil, nil, err
	}
	if err := cmd.Start(); err != nil {
		cancel()
		return nil, nil, err
	}

	go logPipe(s.cfg.Logger, camera.ID, "live-stdout", stdout)
	go logPipe(s.cfg.Logger, camera.ID, "live-stderr", stderr)

	return &execManagedProcess{cmd: cmd}, cancel, nil
}

func (s *RecordingService) waitForLiveExit(cameraID string, process ManagedProcess) {
	_ = process.Wait()

	s.mu.Lock()
	session := s.live[cameraID]
	if session != nil && session.process == process {
		delete(s.live, cameraID)
	}
	s.mu.Unlock()
	_ = os.RemoveAll(filepath.Join(s.cfg.LiveRoot, cameraID))
}

func (s *RecordingService) waitForLiveAsset(ctx context.Context, fullPath string) error {
	deadline := time.Now().Add(s.cfg.LiveStartupTimeout)
	for {
		if _, err := os.Stat(fullPath); err == nil {
			return nil
		} else if !errors.Is(err, os.ErrNotExist) {
			return err
		}

		if ctx.Err() != nil {
			return ctx.Err()
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("live stream asset %s not ready", filepath.Base(fullPath))
		}
		time.Sleep(200 * time.Millisecond)
	}
}

func (s *RecordingService) touchLiveSession(cameraID string) {
	s.mu.Lock()
	if session := s.live[cameraID]; session != nil {
		session.lastAccessAt = s.cfg.Now().UTC()
	}
	s.mu.Unlock()
}

func (s *RecordingService) runLiveCleanupLoop() {
	ticker := time.NewTicker(s.cfg.LiveCleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		now := s.cfg.Now().UTC()
		var stale []string

		s.mu.RLock()
		for cameraID, session := range s.live {
			if session == nil || session.process == nil {
				continue
			}
			if now.Sub(session.lastAccessAt) >= s.cfg.LiveIdleTimeout {
				stale = append(stale, cameraID)
			}
		}
		s.mu.RUnlock()

		for _, cameraID := range stale {
			s.stopLiveSession(cameraID)
		}
	}
}

func (s *RecordingService) stopLiveSession(cameraID string) {
	s.mu.Lock()
	session := s.live[cameraID]
	if session == nil {
		s.mu.Unlock()
		return
	}
	delete(s.live, cameraID)
	s.mu.Unlock()

	if session.cancel != nil {
		session.cancel()
	}
}

func validateLiveAssetPath(asset string) (string, error) {
	if asset == "" {
		return "", errors.New("live asset is required")
	}
	clean := filepath.ToSlash(filepath.Clean(filepath.FromSlash(asset)))
	if strings.HasPrefix(clean, "../") || clean == ".." || filepath.IsAbs(clean) {
		return "", errors.New("invalid live asset path")
	}
	if strings.Contains(clean, "/") && clean != "index.m3u8" {
		return "", errors.New("nested live asset paths are not supported")
	}
	return clean, nil
}

func detectLiveContentType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	if ext == ".m3u8" {
		return "application/vnd.apple.mpegurl"
	}
	if ext == ".ts" {
		return "video/mp2t"
	}
	if contentType := mime.TypeByExtension(ext); contentType != "" {
		return contentType
	}
	return "application/octet-stream"
}
