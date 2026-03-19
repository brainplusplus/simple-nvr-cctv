package db

import (
	"context"

	"simple-nvr-cctv/internal/models"

	"gorm.io/gorm"
)

type CameraRepository struct {
	db *gorm.DB
}

func NewCameraRepository(db *gorm.DB) *CameraRepository {
	return &CameraRepository{db: db}
}

func (r *CameraRepository) List(ctx context.Context) ([]models.Camera, error) {
	var cameras []models.Camera
	if err := r.db.WithContext(ctx).Preload("RecordingSetting").Order("created_at DESC").Find(&cameras).Error; err != nil {
		return nil, err
	}
	return cameras, nil
}

func (r *CameraRepository) ListEnabled(ctx context.Context) ([]models.Camera, error) {
	var cameras []models.Camera
	if err := r.db.WithContext(ctx).Preload("RecordingSetting").Where("enabled = ?", true).Order("created_at DESC").Find(&cameras).Error; err != nil {
		return nil, err
	}
	return cameras, nil
}

func (r *CameraRepository) Get(ctx context.Context, id string) (*models.Camera, error) {
	var camera models.Camera
	if err := r.db.WithContext(ctx).Preload("RecordingSetting").First(&camera, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &camera, nil
}

func (r *CameraRepository) Create(ctx context.Context, camera *models.Camera) error {
	return r.db.WithContext(ctx).Create(camera).Error
}

func (r *CameraRepository) Update(ctx context.Context, camera *models.Camera) error {
	return r.db.WithContext(ctx).Session(&gorm.Session{FullSaveAssociations: true}).Save(camera).Error
}

func (r *CameraRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&models.Camera{}, "id = ?", id).Error
}
