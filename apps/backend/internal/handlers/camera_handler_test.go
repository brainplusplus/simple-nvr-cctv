package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"simple-nvr-cctv/internal/models"
	"simple-nvr-cctv/internal/services"

	"github.com/labstack/echo/v4"
)

func TestCameraHandlerCreateReturnsCreatedCamera(t *testing.T) {
	createdAt := time.Date(2026, 3, 19, 12, 0, 0, 0, time.UTC)
	service := &fakeCameraService{
		createResponse: &models.CameraResponse{
			ID:               "cam-1",
			Name:             "Front Gate",
			RTSPURL:          "rtsp://example/front",
			Enabled:          true,
			CreatedAt:        createdAt,
			RecordingSetting: models.RecordingSettingResponse{Mode: models.RecordingModeContinuous, RetentionType: models.RetentionTypeDays, RetentionValue: 7},
		},
	}

	handler := NewCameraHandler(service)
	payload := map[string]any{
		"name":     "Front Gate",
		"rtsp_url": "rtsp://example/front",
		"enabled":  true,
		"recording_setting": map[string]any{
			"mode":            "continuous",
			"retention_type":  "days",
			"retention_value": 7,
		},
	}
	body, _ := json.Marshal(payload)

	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/cameras", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := handler.Create(c); err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, rec.Code)
	}

	if service.lastCreateInput.Name != "Front Gate" {
		t.Fatalf("expected create input name to be captured, got %q", service.lastCreateInput.Name)
	}

	if service.lastCreateInput.RecordingSetting.RetentionValue != 7 {
		t.Fatalf("expected retention value 7, got %d", service.lastCreateInput.RecordingSetting.RetentionValue)
	}
}

type fakeCameraService struct {
	createResponse  *models.CameraResponse
	lastCreateInput services.CreateCameraInput
}

func (f *fakeCameraService) List(context.Context) ([]models.CameraResponse, error) {
	return nil, nil
}

func (f *fakeCameraService) Get(context.Context, string) (*models.CameraResponse, error) {
	return nil, nil
}

func (f *fakeCameraService) Create(_ context.Context, input services.CreateCameraInput) (*models.CameraResponse, error) {
	f.lastCreateInput = input
	return f.createResponse, nil
}

func (f *fakeCameraService) Update(context.Context, string, services.UpdateCameraInput) (*models.CameraResponse, error) {
	return nil, nil
}

func (f *fakeCameraService) Delete(context.Context, string) error {
	return nil
}
