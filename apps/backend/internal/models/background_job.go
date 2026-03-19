package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BackgroundJobStatus constants
const (
	BackgroundJobStatusStarted  = "started"
	BackgroundJobStatusFinished = "finished"
	BackgroundJobStatusError    = "error"
	BackgroundJobStatusExpired  = "expired"
)

// BackgroundJobTriggeredBy constants
const (
	BackgroundJobTriggeredByButton = "button"
	BackgroundJobTriggeredByCron   = "cron"
)

// BackgroundJob represents a background job for tracking progress
type BackgroundJob struct {
	ID                string     `json:"id" gorm:"primaryKey;type:uuid"`
	Type              string     `json:"type" gorm:"index"`
	TriggeredBy       string     `json:"triggered_by"`
	TotalProgressData int        `json:"total_progress_data"`
	TotalData         int        `json:"total_data"`
	TotalProgressPage int        `json:"total_progress_page"`
	TotalPage         int        `json:"total_page"`
	StartedAt         *time.Time `json:"started_at"`
	ExpiredAt         *time.Time `json:"expired_at"`
	FinishedAt        *time.Time `json:"finished_at"`
	ErrorAt           *time.Time `json:"error_at"`
	ErrorMessage      string     `json:"error_message"`
	Status            string     `json:"status" gorm:"index"`
	CreatedAt         time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         time.Time  `json:"updated_at" gorm:"autoUpdateTime"`
}

// BeforeCreate generates UUID v7 for time-ordered IDs
func (b *BackgroundJob) BeforeCreate(tx *gorm.DB) error {
	if b.ID == "" {
		id, err := uuid.NewV7()
		if err != nil {
			b.ID = uuid.New().String()
		} else {
			b.ID = id.String()
		}
	}
	return nil
}

// AllowedBackgroundJobFilterFields defines whitelist of filterable fields
var AllowedBackgroundJobFilterFields = map[string]bool{
	"id":                  true,
	"type":                true,
	"triggered_by":        true,
	"total_progress_data": true,
	"total_data":          true,
	"total_progress_page": true,
	"total_page":          true,
	"started_at":          true,
	"expired_at":          true,
	"finished_at":         true,
	"error_at":            true,
	"error_message":       true,
	"status":              true,
	"created_at":          true,
	"updated_at":          true,
}

// BackgroundJobSearchRequest represents a search request for BackgroundJob
type BackgroundJobSearchRequest struct {
	Filter *FilterGroup `json:"filter"`
	Sort   []SortField  `json:"sort"`
	Page   int          `json:"page"`
	Limit  int          `json:"limit"`
}

// BackgroundJobSearchResponse represents the search response for BackgroundJob
type BackgroundJobSearchResponse struct {
	Data       []BackgroundJob `json:"data"`
	Total      int             `json:"total"`
	Page       int             `json:"page"`
	Limit      int             `json:"limit"`
	TotalPages int             `json:"total_pages"`
}
