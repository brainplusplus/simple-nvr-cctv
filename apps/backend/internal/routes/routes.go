package routes

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"simple-nvr-cctv/internal/handlers"
	"simple-nvr-cctv/internal/infrastructure"
	"simple-nvr-cctv/internal/middleware"
	dbRepo "simple-nvr-cctv/internal/repositories/db"
	emailRepo "simple-nvr-cctv/internal/repositories/email"
	"simple-nvr-cctv/internal/services"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

// SetupRoutes configures all API routes with dependency injection
func SetupRoutes(e *echo.Echo, db *gorm.DB) {
	// Initialize SMTP client
	smtpClient := infrastructure.NewSmtpClient()

	// ===== Repositories =====
	userRepo := dbRepo.NewUserRepository(db)
	tableSettingRepo := dbRepo.NewTableSettingRepository(db)
	backgroundJobRepo := dbRepo.NewBackgroundJobRepository(db)
	cameraRepo := dbRepo.NewCameraRepository(db)
	emailAuthRepo := emailRepo.NewEmailAuthRepository(smtpClient)

	// ===== Services =====
	authService := services.NewAuthService(userRepo, emailAuthRepo)
	tableSettingService := services.NewTableSettingService(tableSettingRepo)
	backgroundJobService := services.NewBackgroundJobService(backgroundJobRepo)
	nvrConfig := loadNVRConfig()
	var relay services.RelayManager
	if nvrConfig.go2rtcAPIURL != "" && nvrConfig.go2rtcRTSPURL != "" {
		relay = services.NewGo2RTCRelayManager(services.Go2RTCRelayConfig{
			APIURL:       nvrConfig.go2rtcAPIURL,
			RTSPURL:      nvrConfig.go2rtcRTSPURL,
			StreamPrefix: nvrConfig.go2rtcStreamPrefix,
		})
	}
	recorderSupervisor := services.NewRecorderSupervisor(services.RecorderSupervisorConfig{
		RecordingsRoot:        nvrConfig.recordingsRoot,
		Relay:                 relay,
		SegmentSeconds:        nvrConfig.segmentSeconds,
		HealthStaleAfter:      nvrConfig.healthStaleAfter,
		InitialRestartBackoff: nvrConfig.initialRestartBackoff,
		MaxRestartBackoff:     nvrConfig.maxRestartBackoff,
		StopTimeout:           nvrConfig.stopTimeout,
	}, nil, log.Default())
	cameraService := services.NewCameraService(cameraRepo, recorderSupervisor, relay)
	recordingService := services.NewRecordingService(services.RecordingServiceConfig{
		RecordingsRoot:  nvrConfig.recordingsRoot,
		FFmpegBinary:    nvrConfig.ffmpegBinary,
		SnapshotTTL:     nvrConfig.snapshotTTL,
		SnapshotTimeout: nvrConfig.snapshotTimeout,
	}, cameraRepo, relay)
	retentionService := services.NewRetentionService(services.RetentionConfig{})

	// ===== Handlers =====
	authHandler := handlers.NewAuthHandler(authService)
	userHandler := handlers.NewUserHandler(authService)
	tableSettingHandler := handlers.NewTableSettingHandler(tableSettingService)
	backgroundJobHandler := handlers.NewBackgroundJobHandler(backgroundJobService)
	cameraHandler := handlers.NewCameraHandler(cameraService)
	recordingHandler := handlers.NewRecordingHandler(recordingService)

	go func() {
		ctx := context.Background()
		enabledCameras, err := cameraRepo.ListEnabled(ctx)
		if err != nil {
			log.Printf("failed to load enabled cameras on startup: %v", err)
			return
		}
		if relay != nil {
			for _, camera := range enabledCameras {
				if err := relay.SyncCamera(ctx, camera); err != nil {
					log.Printf("failed to sync relay for camera %s: %v", camera.ID, err)
				}
			}
		}
		recorderSupervisor.ResumeEnabledCameras(ctx, enabledCameras)
	}()

	go startRetentionLoop(cameraRepo, retentionService, nvrConfig)

	// ===== API Routes =====
	api := e.Group("/api")

	// Health check
	api.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status": "ok",
		})
	})

	// Public routes (no auth required)
	auth := api.Group("/auth")
	auth.POST("/login", authHandler.Login)
	auth.POST("/verify-otp", authHandler.VerifyOtp)
	auth.POST("/forgot-password", authHandler.ForgotPassword)
	auth.POST("/reset-password", authHandler.ResetPassword)

	// Protected routes (auth required)
	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware(authService))

	// Auth - protected
	protected.GET("/auth/me", authHandler.GetMe)
	protected.POST("/auth/change-password", authHandler.ChangePassword)

	// Users (admin only in practice, but protected by auth)
	protected.GET("/users", userHandler.GetAll)
	protected.GET("/users/:id", userHandler.GetByID)
	protected.POST("/users", userHandler.Create)
	protected.PUT("/users/:id", userHandler.Update)
	protected.DELETE("/users/:id", userHandler.Delete)

	// Table Settings
	protected.GET("/table-settings/:module", tableSettingHandler.Get)
	protected.POST("/table-settings/:module", tableSettingHandler.Save)
	protected.DELETE("/table-settings/:module", tableSettingHandler.Delete)

	// Background Jobs
	protected.GET("/background-jobs", backgroundJobHandler.GetAll)
	protected.GET("/background-jobs/active", backgroundJobHandler.GetActive)
	protected.GET("/background-jobs/:id", backgroundJobHandler.GetByID)
	protected.POST("/background-jobs/search", backgroundJobHandler.Search)

	protected.GET("/cameras", cameraHandler.List)
	protected.GET("/cameras/:id", cameraHandler.Get)
	protected.POST("/cameras", cameraHandler.Create)
	protected.PUT("/cameras/:id", cameraHandler.Update)
	protected.DELETE("/cameras/:id", cameraHandler.Delete)
	protected.GET("/cameras/:id/snapshot", recordingHandler.Snapshot)
	protected.GET("/cameras/:id/live/index.m3u8", recordingHandler.LivePlaylist)
	protected.GET("/cameras/:id/live/:asset", recordingHandler.LiveAsset)
	protected.POST("/cameras/:id/webrtc/offer", recordingHandler.WebRTCOffer)

	protected.GET("/recordings", recordingHandler.List)
	protected.DELETE("/recordings", recordingHandler.Delete)
	protected.GET("/recordings/file", recordingHandler.ServeFile)
}

type nvrConfig struct {
	recordingsRoot        string
	ffmpegBinary          string
	go2rtcAPIURL          string
	go2rtcRTSPURL         string
	go2rtcStreamPrefix    string
	segmentSeconds        int
	retentionInterval     time.Duration
	healthStaleAfter      time.Duration
	snapshotTTL           time.Duration
	snapshotTimeout       time.Duration
	initialRestartBackoff time.Duration
	maxRestartBackoff     time.Duration
	stopTimeout           time.Duration
}

func loadNVRConfig() nvrConfig {
	return nvrConfig{
		recordingsRoot:        envString("RECORDINGS_ROOT", "recordings"),
		ffmpegBinary:          envString("FFMPEG_BIN", "ffmpeg"),
		go2rtcAPIURL:          envString("GO2RTC_API_URL", ""),
		go2rtcRTSPURL:         envString("GO2RTC_RTSP_URL", ""),
		go2rtcStreamPrefix:    envString("GO2RTC_STREAM_PREFIX", "camera_"),
		segmentSeconds:        envInt("NVR_SEGMENT_SECONDS", 3600),
		retentionInterval:     time.Duration(envInt("NVR_RETENTION_INTERVAL_SECONDS", 300)) * time.Second,
		healthStaleAfter:      time.Duration(envInt("NVR_HEALTH_STALE_SECONDS", 600)) * time.Second,
		snapshotTTL:           time.Duration(envInt("NVR_SNAPSHOT_CACHE_SECONDS", 60)) * time.Second,
		snapshotTimeout:       time.Duration(envInt("NVR_SNAPSHOT_TIMEOUT_SECONDS", 10)) * time.Second,
		initialRestartBackoff: time.Duration(envInt("NVR_WORKER_INITIAL_BACKOFF_SECONDS", 2)) * time.Second,
		maxRestartBackoff:     time.Duration(envInt("NVR_WORKER_MAX_BACKOFF_SECONDS", 60)) * time.Second,
		stopTimeout:           time.Duration(envInt("NVR_WORKER_STOP_TIMEOUT_SECONDS", 10)) * time.Second,
	}
}

func startRetentionLoop(cameraRepo *dbRepo.CameraRepository, retentionService *services.RetentionService, cfg nvrConfig) {
	ticker := time.NewTicker(cfg.retentionInterval)
	defer ticker.Stop()
	for range ticker.C {
		ctx := context.Background()
		cameras, err := cameraRepo.List(ctx)
		if err != nil {
			log.Printf("retention loop: failed to list cameras: %v", err)
			continue
		}
		for _, camera := range cameras {
			root := filepath.Join(cfg.recordingsRoot, camera.ID)
			if _, err := retentionService.ApplyPolicy(root, camera.RecordingSetting); err != nil {
				log.Printf("retention loop: camera=%s error=%v", camera.ID, err)
			}
		}
	}
}

func envString(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return fallback
}
