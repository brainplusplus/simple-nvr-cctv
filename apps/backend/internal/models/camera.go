package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	RecordingModeContinuous = "continuous"
	RetentionTypeDays       = "days"
	RetentionTypeSize       = "size"

	CameraHealthOnline  = "online"
	CameraHealthOffline = "offline"
	CameraHealthStopped = "stopped"
	CameraHealthError   = "error"
)

type Camera struct {
	ID               string           `json:"id" gorm:"primaryKey;type:uuid"`
	Name             string           `json:"name" gorm:"not null"`
	RTSPURL          string           `json:"rtsp_url" gorm:"column:rtsp_url;not null"`
	Enabled          bool             `json:"enabled" gorm:"default:false"`
	CreatedAt        time.Time        `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time        `json:"updated_at" gorm:"autoUpdateTime"`
	RecordingSetting RecordingSetting `json:"recording_setting" gorm:"foreignKey:CameraID;references:ID;constraint:OnDelete:CASCADE"`
}

func (c *Camera) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.NewString()
	}
	if c.RecordingSetting.CameraID == "" {
		c.RecordingSetting.CameraID = c.ID
	}
	return nil
}

type RecordingSetting struct {
	CameraID       string    `json:"camera_id" gorm:"primaryKey;type:uuid"`
	Mode           string    `json:"mode" gorm:"not null;default:'continuous'"`
	RetentionType  string    `json:"retention_type" gorm:"not null;default:'days'"`
	RetentionValue int       `json:"retention_value" gorm:"not null;default:7"`
	CreatedAt      time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

type RecordingSettingResponse struct {
	CameraID       string `json:"camera_id,omitempty"`
	Mode           string `json:"mode"`
	RetentionType  string `json:"retention_type"`
	RetentionValue int    `json:"retention_value"`
}

type CameraRuntimeStatus struct {
	State         string     `json:"state"`
	PID           int        `json:"pid,omitempty"`
	LastStartAt   *time.Time `json:"last_start_at,omitempty"`
	LastExitAt    *time.Time `json:"last_exit_at,omitempty"`
	LastSegmentAt *time.Time `json:"last_segment_at,omitempty"`
	LastError     string     `json:"last_error,omitempty"`
	RestartCount  int        `json:"restart_count"`
	NextRestartAt *time.Time `json:"next_restart_at,omitempty"`
}

type CameraResponse struct {
	ID               string                   `json:"id"`
	Name             string                   `json:"name"`
	RTSPURL          string                   `json:"rtsp_url"`
	Enabled          bool                     `json:"enabled"`
	CreatedAt        time.Time                `json:"created_at"`
	UpdatedAt        time.Time                `json:"updated_at"`
	RecordingSetting RecordingSettingResponse `json:"recording_setting"`
	RuntimeStatus    CameraRuntimeStatus      `json:"runtime_status"`
}

func (c Camera) ToResponse(status CameraRuntimeStatus) CameraResponse {
	return CameraResponse{
		ID:        c.ID,
		Name:      c.Name,
		RTSPURL:   c.RTSPURL,
		Enabled:   c.Enabled,
		CreatedAt: c.CreatedAt,
		UpdatedAt: c.UpdatedAt,
		RecordingSetting: RecordingSettingResponse{
			CameraID:       c.RecordingSetting.CameraID,
			Mode:           c.RecordingSetting.Mode,
			RetentionType:  c.RecordingSetting.RetentionType,
			RetentionValue: c.RecordingSetting.RetentionValue,
		},
		RuntimeStatus: status,
	}
}
