package db

import (
	"context"

	"simple-nvr-cctv/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// TableSettingRepository handles table settings data access operations
type TableSettingRepository struct {
	db *gorm.DB
}

// NewTableSettingRepository creates a new TableSettingRepository
func NewTableSettingRepository(db *gorm.DB) *TableSettingRepository {
	return &TableSettingRepository{db: db}
}

// GetByUserAndModule returns a table setting for a specific user and module
func (r *TableSettingRepository) GetByUserAndModule(ctx context.Context, userID, module string) (*models.TableSetting, error) {
	var setting models.TableSetting
	err := r.db.Where("user_id = ? AND module = ?", userID, module).First(&setting).Error
	if err != nil {
		return nil, err
	}
	return &setting, nil
}

// Upsert creates or updates a table setting
func (r *TableSettingRepository) Upsert(ctx context.Context, setting *models.TableSetting) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"table_name", "values", "updated_at"}),
	}).Create(setting).Error
}

// Delete deletes a table setting for a specific user and module
func (r *TableSettingRepository) Delete(ctx context.Context, userID, module string) error {
	return r.db.Where("user_id = ? AND module = ?", userID, module).Delete(&models.TableSetting{}).Error
}
