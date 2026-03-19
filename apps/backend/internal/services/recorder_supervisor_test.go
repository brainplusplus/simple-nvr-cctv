package services

import (
	"context"
	"errors"
	"io"
	"log"
	"os"
	"path/filepath"
	"testing"
	"time"

	"simple-nvr-cctv/internal/models"
)

func TestRecorderSupervisorStartsAndStopsCamera(t *testing.T) {
	process := &fakeManagedProcess{waitCh: make(chan error, 1)}
	runner := &fakeFFmpegRunner{process: process}
	supervisor := NewRecorderSupervisor(RecorderSupervisorConfig{
		RecordingsRoot:        t.TempDir(),
		SegmentSeconds:        300,
		HealthStaleAfter:      10 * time.Minute,
		InitialRestartBackoff: time.Second,
		MaxRestartBackoff:     10 * time.Second,
		Now:                   time.Now,
	}, runner, log.New(io.Discard, "", 0))

	camera := models.Camera{ID: "cam-1", Name: "Front Gate", RTSPURL: "rtsp://example/front", Enabled: true}

	if err := supervisor.StartCamera(context.Background(), camera); err != nil {
		t.Fatalf("StartCamera returned error: %v", err)
	}

	status, ok := supervisor.GetStatus(camera.ID)
	if !ok {
		t.Fatalf("expected status for camera")
	}

	if status.State != models.CameraHealthOnline {
		t.Fatalf("expected online state, got %s", status.State)
	}

	if len(runner.requests) != 1 {
		t.Fatalf("expected one runner start request, got %d", len(runner.requests))
	}

	if err := supervisor.StopCamera(camera.ID); err != nil {
		t.Fatalf("StopCamera returned error: %v", err)
	}

	if !process.stopCalled {
		t.Fatalf("expected process stop to be called")
	}
}

func TestRecorderSupervisorMarksCameraOfflineAfterUnexpectedExit(t *testing.T) {
	process := &fakeManagedProcess{waitCh: make(chan error, 1)}
	runner := &fakeFFmpegRunner{process: process}
	now := time.Date(2026, 3, 19, 12, 0, 0, 0, time.UTC)
	supervisor := NewRecorderSupervisor(RecorderSupervisorConfig{
		RecordingsRoot:        t.TempDir(),
		SegmentSeconds:        300,
		HealthStaleAfter:      10 * time.Minute,
		InitialRestartBackoff: 2 * time.Second,
		MaxRestartBackoff:     10 * time.Second,
		Now:                   func() time.Time { return now },
	}, runner, log.New(io.Discard, "", 0))

	camera := models.Camera{ID: "cam-2", Name: "Garage", RTSPURL: "rtsp://example/garage", Enabled: true}
	if err := supervisor.StartCamera(context.Background(), camera); err != nil {
		t.Fatalf("StartCamera returned error: %v", err)
	}

	supervisor.handleProcessExit(camera.ID, errors.New("ffmpeg crashed"))

	status, ok := supervisor.GetStatus(camera.ID)
	if !ok {
		t.Fatalf("expected status for camera")
	}

	if status.State != models.CameraHealthOffline {
		t.Fatalf("expected offline state after crash, got %s", status.State)
	}

	if status.RestartCount != 1 {
		t.Fatalf("expected restart count 1, got %d", status.RestartCount)
	}

	if status.NextRestartAt == nil {
		t.Fatalf("expected next restart time to be set")
	}
}

func TestEnsureRecordingDirsCreatesTodayAndTomorrowFolders(t *testing.T) {
	root := t.TempDir()
	now := time.Date(2026, 3, 19, 23, 59, 0, 0, time.UTC)

	if err := ensureRecordingDirs(root, "cam-1", now); err != nil {
		t.Fatalf("ensureRecordingDirs returned error: %v", err)
	}

	for _, day := range []time.Time{now, now.Add(24 * time.Hour)} {
		dir := filepath.Join(root, "cam-1", day.Format("2006"), day.Format("01"), day.Format("02"))
		info, err := os.Stat(dir)
		if err != nil {
			t.Fatalf("expected directory %s to exist: %v", dir, err)
		}
		if !info.IsDir() {
			t.Fatalf("expected %s to be a directory", dir)
		}
	}
}

func TestRecorderSupervisorUsesHourlySegmentsAndReadableFilePattern(t *testing.T) {
	process := &fakeManagedProcess{waitCh: make(chan error, 1)}
	runner := &fakeFFmpegRunner{process: process}
	supervisor := NewRecorderSupervisor(RecorderSupervisorConfig{
		RecordingsRoot: t.TempDir(),
		Now:            time.Now,
	}, runner, log.New(io.Discard, "", 0))

	camera := models.Camera{ID: "cam-hourly", Name: "Hourly Camera", RTSPURL: "rtsp://example/hourly", Enabled: true}
	if err := supervisor.StartCamera(context.Background(), camera); err != nil {
		t.Fatalf("StartCamera returned error: %v", err)
	}

	if len(runner.requests) != 1 {
		t.Fatalf("expected one runner request, got %d", len(runner.requests))
	}

	request := runner.requests[0]
	if request.SegmentSeconds != 3600 {
		t.Fatalf("expected hourly segment length, got %d", request.SegmentSeconds)
	}

	expectedSuffix := filepath.Join("cam-hourly", "%Y", "%m", "%d", "%Y%m%d_%H0000.mp4")
	if request.OutputPattern != filepath.Join(supervisor.cfg.RecordingsRoot, expectedSuffix) {
		t.Fatalf("unexpected output pattern %q", request.OutputPattern)
	}
	_ = supervisor.StopCamera(camera.ID)
}

type fakeFFmpegRunner struct {
	requests []FFmpegStartRequest
	process  ManagedProcess
	err      error
}

func (f *fakeFFmpegRunner) Start(_ context.Context, request FFmpegStartRequest) (ManagedProcess, error) {
	f.requests = append(f.requests, request)
	return f.process, f.err
}

type fakeManagedProcess struct {
	waitCh     chan error
	stopCalled bool
}

func (f *fakeManagedProcess) PID() int { return 1234 }

func (f *fakeManagedProcess) Stop(_ time.Duration) error {
	f.stopCalled = true
	select {
	case f.waitCh <- context.Canceled:
	default:
	}
	return nil
}

func (f *fakeManagedProcess) Wait() error {
	return <-f.waitCh
}
