package services

import (
	"context"
	"errors"

	"simple-nvr-cctv/internal/models"
)

type RecordingSettingInput struct {
	Mode           string `json:"mode"`
	RetentionType  string `json:"retention_type"`
	RetentionValue int    `json:"retention_value"`
}

type CreateCameraInput struct {
	Name             string                `json:"name"`
	RTSPURL          string                `json:"rtsp_url"`
	Enabled          bool                  `json:"enabled"`
	RecordingSetting RecordingSettingInput `json:"recording_setting"`
}

type UpdateCameraInput struct {
	Name             string                `json:"name"`
	RTSPURL          string                `json:"rtsp_url"`
	Enabled          bool                  `json:"enabled"`
	RecordingSetting RecordingSettingInput `json:"recording_setting"`
}

type CameraServiceAPI interface {
	List(ctx context.Context) ([]models.CameraResponse, error)
	Get(ctx context.Context, id string) (*models.CameraResponse, error)
	Create(ctx context.Context, input CreateCameraInput) (*models.CameraResponse, error)
	Update(ctx context.Context, id string, input UpdateCameraInput) (*models.CameraResponse, error)
	Delete(ctx context.Context, id string) error
}

type CameraRepositoryAPI interface {
	List(ctx context.Context) ([]models.Camera, error)
	ListEnabled(ctx context.Context) ([]models.Camera, error)
	Get(ctx context.Context, id string) (*models.Camera, error)
	Create(ctx context.Context, camera *models.Camera) error
	Update(ctx context.Context, camera *models.Camera) error
	Delete(ctx context.Context, id string) error
}

type CameraRuntimeProvider interface {
	SyncCamera(ctx context.Context, camera models.Camera) error
	GetStatus(cameraID string) (models.CameraRuntimeStatus, bool)
	RemoveCamera(cameraID string) error
	ResumeEnabledCameras(ctx context.Context, cameras []models.Camera)
}

type CameraService struct {
	repo    CameraRepositoryAPI
	runtime CameraRuntimeProvider
}

func NewCameraService(repo CameraRepositoryAPI, runtime CameraRuntimeProvider) *CameraService {
	return &CameraService{repo: repo, runtime: runtime}
}

func (s *CameraService) List(ctx context.Context) ([]models.CameraResponse, error) {
	cameras, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}
	responses := make([]models.CameraResponse, 0, len(cameras))
	for _, camera := range cameras {
		responses = append(responses, camera.ToResponse(s.getStatus(camera.ID, camera.Enabled)))
	}
	return responses, nil
}

func (s *CameraService) Get(ctx context.Context, id string) (*models.CameraResponse, error) {
	camera, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	response := camera.ToResponse(s.getStatus(camera.ID, camera.Enabled))
	return &response, nil
}

func (s *CameraService) Create(ctx context.Context, input CreateCameraInput) (*models.CameraResponse, error) {
	if err := validateCameraInput(input.Name, input.RTSPURL, input.RecordingSetting); err != nil {
		return nil, err
	}

	camera := &models.Camera{
		Name:    input.Name,
		RTSPURL: input.RTSPURL,
		Enabled: input.Enabled,
		RecordingSetting: models.RecordingSetting{
			Mode:           normalizeMode(input.RecordingSetting.Mode),
			RetentionType:  normalizeRetentionType(input.RecordingSetting.RetentionType),
			RetentionValue: normalizeRetentionValue(input.RecordingSetting.RetentionValue),
		},
	}
	if err := s.repo.Create(ctx, camera); err != nil {
		return nil, err
	}
	if s.runtime != nil {
		_ = s.runtime.SyncCamera(ctx, *camera)
	}
	response := camera.ToResponse(s.getStatus(camera.ID, camera.Enabled))
	return &response, nil
}

func (s *CameraService) Update(ctx context.Context, id string, input UpdateCameraInput) (*models.CameraResponse, error) {
	if err := validateCameraInput(input.Name, input.RTSPURL, input.RecordingSetting); err != nil {
		return nil, err
	}
	camera, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	camera.Name = input.Name
	camera.RTSPURL = input.RTSPURL
	camera.Enabled = input.Enabled
	camera.RecordingSetting.CameraID = camera.ID
	camera.RecordingSetting.Mode = normalizeMode(input.RecordingSetting.Mode)
	camera.RecordingSetting.RetentionType = normalizeRetentionType(input.RecordingSetting.RetentionType)
	camera.RecordingSetting.RetentionValue = normalizeRetentionValue(input.RecordingSetting.RetentionValue)
	if err := s.repo.Update(ctx, camera); err != nil {
		return nil, err
	}
	if s.runtime != nil {
		_ = s.runtime.SyncCamera(ctx, *camera)
	}
	response := camera.ToResponse(s.getStatus(camera.ID, camera.Enabled))
	return &response, nil
}

func (s *CameraService) Delete(ctx context.Context, id string) error {
	if s.runtime != nil {
		_ = s.runtime.RemoveCamera(id)
	}
	return s.repo.Delete(ctx, id)
}

func (s *CameraService) ListEnabled(ctx context.Context) ([]models.Camera, error) {
	return s.repo.ListEnabled(ctx)
}

func (s *CameraService) getStatus(cameraID string, enabled bool) models.CameraRuntimeStatus {
	if s.runtime != nil {
		if status, ok := s.runtime.GetStatus(cameraID); ok {
			return status
		}
	}
	state := models.CameraHealthStopped
	if enabled {
		state = models.CameraHealthOffline
	}
	return models.CameraRuntimeStatus{State: state}
}

func validateCameraInput(name, rtspURL string, setting RecordingSettingInput) error {
	if name == "" || rtspURL == "" {
		return errors.New("name and rtsp_url are required")
	}
	mode := normalizeMode(setting.Mode)
	if mode != models.RecordingModeContinuous {
		return errors.New("unsupported recording mode")
	}
	rType := normalizeRetentionType(setting.RetentionType)
	if rType != models.RetentionTypeDays && rType != models.RetentionTypeSize {
		return errors.New("unsupported retention type")
	}
	if normalizeRetentionValue(setting.RetentionValue) <= 0 {
		return errors.New("retention_value must be greater than zero")
	}
	return nil
}

func normalizeMode(mode string) string {
	if mode == "" {
		return models.RecordingModeContinuous
	}
	return mode
}

func normalizeRetentionType(retentionType string) string {
	if retentionType == "" {
		return models.RetentionTypeDays
	}
	return retentionType
}

func normalizeRetentionValue(value int) int {
	if value <= 0 {
		return 7
	}
	return value
}
