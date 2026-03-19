package models

import "time"

type RecordingFile struct {
	CameraID        string    `json:"camera_id"`
	Filename        string    `json:"filename"`
	RelativePath    string    `json:"relative_path"`
	PlaybackURL     string    `json:"playback_url"`
	Timestamp       time.Time `json:"timestamp"`
	Size            int64     `json:"size"`
	DurationSeconds *float64  `json:"duration_seconds,omitempty"`
}

type SnapshotResult struct {
	Content     []byte
	ContentType string
	GeneratedAt time.Time
}
