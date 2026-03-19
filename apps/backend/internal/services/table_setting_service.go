package services

import (
	"context"

	"simple-nvr-cctv/internal/models"
	db "simple-nvr-cctv/internal/repositories/db"
)

// TableSettingService handles table setting business logic
type TableSettingService struct {
	repo *db.TableSettingRepository
}

// NewTableSettingService creates a new TableSettingService
func NewTableSettingService(repo *db.TableSettingRepository) *TableSettingService {
	return &TableSettingService{repo: repo}
}

// GetByUserAndModule returns table settings for a user and module
func (s *TableSettingService) GetByUserAndModule(ctx context.Context, userID, module string) (*models.TableSetting, error) {
	return s.repo.GetByUserAndModule(ctx, userID, module)
}

// Upsert creates or updates a table setting
func (s *TableSettingService) Upsert(ctx context.Context, setting *models.TableSetting) error {
	return s.repo.Upsert(ctx, setting)
}

// Delete deletes a table setting for a user and module
func (s *TableSettingService) Delete(ctx context.Context, userID, module string) error {
	return s.repo.Delete(ctx, userID, module)
}
