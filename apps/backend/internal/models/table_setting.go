package models

import (
	"encoding/json"
	"time"

	"simple-nvr-cctv/internal/domain/identity"

	"gorm.io/gorm"
)

// TableSetting stores DataTable preferences per user and module
type TableSetting struct {
	ID        string          `json:"id" gorm:"primaryKey;type:uuid"`
	UserID    string          `json:"user_id" gorm:"type:uuid;not null;index:idx_table_settings_lookup"`
	TblName   string          `json:"table_name" gorm:"column:table_name;not null;index:idx_table_settings_lookup"`
	Module    string          `json:"module" gorm:"not null;index:idx_table_settings_lookup"`
	Values    json.RawMessage `json:"values" gorm:"type:jsonb"`
	CreatedAt time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
}

// BeforeCreate hook to generate UUID before creating
func (t *TableSetting) BeforeCreate(tx *gorm.DB) error {
	if t.ID == "" && t.UserID != "" && t.TblName != "" && t.Module != "" {
		t.ID = identity.GenerateTableSettingID(t.UserID, t.TblName, t.Module)
	}
	return nil
}

// TableSettingValues represents the JSON structure stored in Values field
type TableSettingValues struct {
	VisibleColumns []string                   `json:"visibleColumns,omitempty"`
	ColumnOrder    []string                   `json:"columnOrder,omitempty"`
	ColumnWidths   map[string]*int            `json:"columnWidths,omitempty"`
	TextOverflow   string                     `json:"textOverflow,omitempty"`
	Filters        map[string]json.RawMessage `json:"filters,omitempty"`
}
