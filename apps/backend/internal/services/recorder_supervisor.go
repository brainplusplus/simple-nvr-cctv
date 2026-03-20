package services

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"syscall"
	"time"

	"simple-nvr-cctv/internal/models"
)

type FFmpegStartRequest struct {
	Camera         models.Camera
	OutputPattern  string
	SegmentSeconds int
}

type ManagedProcess interface {
	PID() int
	Stop(timeout time.Duration) error
	Wait() error
}

type FFmpegRunner interface {
	Start(ctx context.Context, request FFmpegStartRequest) (ManagedProcess, error)
}

type RecorderSupervisorConfig struct {
	RecordingsRoot        string
	SegmentSeconds        int
	HealthStaleAfter      time.Duration
	InitialRestartBackoff time.Duration
	MaxRestartBackoff     time.Duration
	StopTimeout           time.Duration
	Relay                 RelayManager
	Now                   func() time.Time
}

type RecorderSupervisor struct {
	cfg    RecorderSupervisorConfig
	runner FFmpegRunner
	logger *log.Logger

	mu      sync.RWMutex
	workers map[string]*workerState
}

type workerState struct {
	camera       models.Camera
	process      ManagedProcess
	status       models.CameraRuntimeStatus
	backoff      time.Duration
	manualStop   bool
	restartTimer *time.Timer
}

func NewRecorderSupervisor(cfg RecorderSupervisorConfig, runner FFmpegRunner, logger *log.Logger) *RecorderSupervisor {
	if cfg.RecordingsRoot == "" {
		cfg.RecordingsRoot = "recordings"
	}
	if cfg.SegmentSeconds <= 0 {
		cfg.SegmentSeconds = 3600
	}
	if cfg.HealthStaleAfter <= 0 {
		cfg.HealthStaleAfter = 10 * time.Minute
	}
	if cfg.InitialRestartBackoff <= 0 {
		cfg.InitialRestartBackoff = 2 * time.Second
	}
	if cfg.MaxRestartBackoff <= 0 {
		cfg.MaxRestartBackoff = 60 * time.Second
	}
	if cfg.StopTimeout <= 0 {
		cfg.StopTimeout = 10 * time.Second
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	if logger == nil {
		logger = log.Default()
	}
	if runner == nil {
		runner = NewExecFFmpegRunner(os.Getenv("FFMPEG_BIN"), logger)
	}

	return &RecorderSupervisor{cfg: cfg, runner: runner, logger: logger, workers: make(map[string]*workerState)}
}

func (s *RecorderSupervisor) StartCamera(ctx context.Context, camera models.Camera) error {
	if camera.ID == "" {
		return errors.New("camera id is required")
	}
	if err := ensureRecordingDirs(s.cfg.RecordingsRoot, camera.ID, s.cfg.Now().UTC()); err != nil {
		return err
	}
	if s.cfg.Relay != nil {
		if err := s.cfg.Relay.SyncCamera(ctx, camera); err != nil {
			return err
		}
		if relayURL := s.cfg.Relay.RTSPURL(camera.ID); relayURL != "" {
			camera.RTSPURL = relayURL
		}
	}

	request := FFmpegStartRequest{
		Camera:         camera,
		SegmentSeconds: s.cfg.SegmentSeconds,
		OutputPattern:  filepath.Join(s.cfg.RecordingsRoot, camera.ID, "%Y", "%m", "%d", "%Y%m%d_%H0000.mp4"),
	}

	process, err := s.runner.Start(ctx, request)
	if err != nil {
		s.handleProcessExit(camera.ID, err)
		return err
	}

	now := s.cfg.Now().UTC()
	status := models.CameraRuntimeStatus{State: models.CameraHealthOnline, PID: process.PID(), LastStartAt: &now}

	s.mu.Lock()
	state := s.workers[camera.ID]
	if state == nil {
		state = &workerState{camera: camera, backoff: s.cfg.InitialRestartBackoff}
		s.workers[camera.ID] = state
	}
	state.camera = camera
	state.process = process
	state.status.State = status.State
	state.status.PID = status.PID
	state.status.LastStartAt = status.LastStartAt
	state.status.NextRestartAt = nil
	state.manualStop = false
	if state.restartTimer != nil {
		state.restartTimer.Stop()
		state.restartTimer = nil
	}
	s.mu.Unlock()

	go s.waitForExit(camera.ID, process)
	return nil
}

func (s *RecorderSupervisor) StopCamera(cameraID string) error {
	s.mu.Lock()
	state, ok := s.workers[cameraID]
	if !ok {
		s.mu.Unlock()
		return nil
	}
	state.manualStop = true
	state.status.State = models.CameraHealthStopped
	state.status.PID = 0
	process := state.process
	s.mu.Unlock()

	if process != nil {
		return process.Stop(s.cfg.StopTimeout)
	}
	return nil
}

func (s *RecorderSupervisor) SyncCamera(ctx context.Context, camera models.Camera) error {
	if !camera.Enabled {
		return s.StopCamera(camera.ID)
	}
	_ = s.StopCamera(camera.ID)
	return s.StartCamera(ctx, camera)
}

func (s *RecorderSupervisor) ResumeEnabledCameras(ctx context.Context, cameras []models.Camera) {
	for _, camera := range cameras {
		if !camera.Enabled {
			continue
		}
		if err := s.StartCamera(ctx, camera); err != nil {
			s.logger.Printf("failed to resume camera %s: %v", camera.ID, err)
		}
	}
}

func (s *RecorderSupervisor) GetStatus(cameraID string) (models.CameraRuntimeStatus, bool) {
	s.mu.RLock()
	state, ok := s.workers[cameraID]
	if !ok {
		s.mu.RUnlock()
		return models.CameraRuntimeStatus{State: models.CameraHealthStopped}, false
	}
	status := state.status
	status.PID = 0
	if state.process != nil {
		status.PID = state.process.PID()
	}
	s.mu.RUnlock()
	return status, true
}

func (s *RecorderSupervisor) RemoveCamera(cameraID string) error {
	if err := s.StopCamera(cameraID); err != nil {
		return err
	}
	s.mu.Lock()
	delete(s.workers, cameraID)
	s.mu.Unlock()
	return nil
}

func (s *RecorderSupervisor) waitForExit(cameraID string, process ManagedProcess) {
	err := process.Wait()
	if err == nil || errors.Is(err, context.Canceled) {
		return
	}
	s.handleProcessExit(cameraID, err)
}

func (s *RecorderSupervisor) handleProcessExit(cameraID string, err error) {
	now := s.cfg.Now().UTC()

	s.mu.Lock()
	state := s.workers[cameraID]
	if state == nil {
		state = &workerState{backoff: s.cfg.InitialRestartBackoff}
		s.workers[cameraID] = state
	}
	if state.manualStop {
		state.process = nil
		state.status.State = models.CameraHealthStopped
		state.status.PID = 0
		state.status.LastExitAt = &now
		s.mu.Unlock()
		return
	}

	state.process = nil
	state.status.State = models.CameraHealthOffline
	state.status.PID = 0
	state.status.LastExitAt = &now
	state.status.LastError = err.Error()
	state.status.RestartCount++
	if state.backoff <= 0 {
		state.backoff = s.cfg.InitialRestartBackoff
	}
	nextRestart := now.Add(state.backoff)
	state.status.NextRestartAt = &nextRestart
	if state.restartTimer != nil {
		state.restartTimer.Stop()
	}
	backoff := state.backoff
	camera := state.camera
	state.backoff *= 2
	if state.backoff > s.cfg.MaxRestartBackoff {
		state.backoff = s.cfg.MaxRestartBackoff
	}
	state.restartTimer = time.AfterFunc(backoff, func() {
		if camera.ID == "" || !camera.Enabled {
			return
		}
		if startErr := s.StartCamera(context.Background(), camera); startErr != nil {
			s.logger.Printf("restart failed for camera %s: %v", camera.ID, startErr)
		}
	})
	s.mu.Unlock()
}

type ExecFFmpegRunner struct {
	binary string
	logger *log.Logger
}

func NewExecFFmpegRunner(binary string, logger *log.Logger) *ExecFFmpegRunner {
	if binary == "" {
		binary = "ffmpeg"
	}
	if logger == nil {
		logger = log.Default()
	}
	return &ExecFFmpegRunner{binary: binary, logger: logger}
}

func (r *ExecFFmpegRunner) Start(ctx context.Context, request FFmpegStartRequest) (ManagedProcess, error) {
	if err := ensureRecordingDirs(filepath.Dir(filepath.Dir(filepath.Dir(filepath.Dir(request.OutputPattern)))), request.Camera.ID, time.Now().UTC()); err != nil {
		return nil, err
	}

	args := []string{
		"-hide_banner",
		"-loglevel", "warning",
		"-rtsp_transport", "tcp",
		"-analyzeduration", "10000000",
		"-probesize", "10000000",
		"-i", request.Camera.RTSPURL,
		"-map", "0:v:0",
		"-map", "0:a:0?",
		"-c", "copy",
		"-f", "segment",
		"-segment_format", "mp4",
		"-segment_format_options", "movflags=+faststart",
		"-segment_time", fmt.Sprintf("%d", request.SegmentSeconds),
		"-reset_timestamps", "1",
		"-strftime", "1",
		request.OutputPattern,
	}

	cmd := exec.CommandContext(ctx, r.binary, args...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}

	go logPipe(r.logger, request.Camera.ID, "stdout", stdout)
	go logPipe(r.logger, request.Camera.ID, "stderr", stderr)

	return &execManagedProcess{cmd: cmd}, nil
}

func ensureRecordingDirs(root, cameraID string, now time.Time) error {
	for _, day := range []time.Time{now, now.Add(24 * time.Hour)} {
		dir := filepath.Join(root, cameraID, day.Format("2006"), day.Format("01"), day.Format("02"))
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}
	return nil
}

type execManagedProcess struct {
	cmd *exec.Cmd
}

func (p *execManagedProcess) PID() int {
	if p.cmd.Process == nil {
		return 0
	}
	return p.cmd.Process.Pid
}

func (p *execManagedProcess) Stop(timeout time.Duration) error {
	if p.cmd.Process == nil {
		return nil
	}
	if runtime.GOOS != "windows" {
		_ = p.cmd.Process.Signal(syscall.SIGINT)
	} else {
		_ = p.cmd.Process.Signal(os.Interrupt)
	}

	done := make(chan error, 1)
	go func() { done <- p.cmd.Wait() }()

	select {
	case err := <-done:
		return err
	case <-time.After(timeout):
		if killErr := p.cmd.Process.Kill(); killErr != nil {
			return killErr
		}
		return <-done
	}
}

func (p *execManagedProcess) Wait() error {
	return p.cmd.Wait()
}

func logPipe(logger *log.Logger, cameraID, stream string, reader io.ReadCloser) {
	defer reader.Close()
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		logger.Printf("camera=%s stream=%s %s", cameraID, stream, scanner.Text())
	}
}
