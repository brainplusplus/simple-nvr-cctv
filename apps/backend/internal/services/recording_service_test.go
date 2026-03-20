package services

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRecordingServiceListsNewestFilesFirst(t *testing.T) {
	root := t.TempDir()
	cameraRoot := filepath.Join(root, "cam-1", "2026", "03", "19")
	if err := os.MkdirAll(cameraRoot, 0o755); err != nil {
		t.Fatalf("MkdirAll returned error: %v", err)
	}

	first := filepath.Join(cameraRoot, "120000.mp4")
	second := filepath.Join(cameraRoot, "121000.mp4")
	if err := os.WriteFile(first, []byte("first"), 0o644); err != nil {
		t.Fatalf("WriteFile first returned error: %v", err)
	}
	if err := os.WriteFile(second, []byte("second"), 0o644); err != nil {
		t.Fatalf("WriteFile second returned error: %v", err)
	}

	service := NewRecordingService(RecordingServiceConfig{RecordingsRoot: root}, nil)
	recordings, err := service.List(context.Background(), "cam-1")
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}

	if len(recordings) != 2 {
		t.Fatalf("expected 2 recordings, got %d", len(recordings))
	}

	if recordings[0].Filename != "121000.mp4" {
		t.Fatalf("expected newest file first, got %s", recordings[0].Filename)
	}

	if recordings[0].PlaybackURL == "" {
		t.Fatalf("expected playback url to be populated")
	}
}

func TestRecordingServiceRejectsPathTraversal(t *testing.T) {
	service := NewRecordingService(RecordingServiceConfig{RecordingsRoot: t.TempDir()}, nil)

	if _, _, _, err := service.OpenFile(context.Background(), "cam-1", "../evil.mp4"); err == nil {
		t.Fatalf("expected path traversal to be rejected")
	}
}

func TestRecordingServiceBuildsSnapshotCacheEntries(t *testing.T) {
	now := time.Date(2026, 3, 19, 12, 0, 0, 0, time.UTC)
	service := NewRecordingService(RecordingServiceConfig{
		RecordingsRoot: t.TempDir(),
		SnapshotTTL:    time.Minute,
		Now:            func() time.Time { return now },
	}, nil)

	service.cacheSnapshot("cam-1", []byte("jpeg"), "image/jpeg")

	result, ok := service.getCachedSnapshot("cam-1")
	if !ok {
		t.Fatalf("expected cached snapshot")
	}

	if result.ContentType != "image/jpeg" {
		t.Fatalf("expected content type image/jpeg, got %s", result.ContentType)
	}
}

func TestParseRecordingTimestampSupportsHourlyFilenamePattern(t *testing.T) {
	fallback := time.Date(2026, 3, 19, 12, 0, 0, 0, time.UTC)
	parsed := parseRecordingTimestamp("2026/03/20/20260320_170000.mp4", fallback)
	expected := time.Date(2026, 3, 20, 17, 0, 0, 0, time.UTC)

	if !parsed.Equal(expected) {
		t.Fatalf("expected %s, got %s", expected.Format(time.RFC3339), parsed.Format(time.RFC3339))
	}
}

func TestRecordingServiceDeletesSelectedFiles(t *testing.T) {
	root := t.TempDir()
	cameraRoot := filepath.Join(root, "cam-1", "2026", "03", "19")
	if err := os.MkdirAll(cameraRoot, 0o755); err != nil {
		t.Fatalf("MkdirAll returned error: %v", err)
	}

	first := filepath.Join(cameraRoot, "20260319_170000.mp4")
	second := filepath.Join(cameraRoot, "20260319_180000.mp4")
	third := filepath.Join(cameraRoot, "20260319_190000.mp4")
	for _, file := range []string{first, second, third} {
		if err := os.WriteFile(file, []byte("recording"), 0o644); err != nil {
			t.Fatalf("WriteFile returned error: %v", err)
		}
	}

	service := NewRecordingService(RecordingServiceConfig{RecordingsRoot: root}, nil)
	result, err := service.Delete(context.Background(), "cam-1", []string{
		"2026/03/19/20260319_170000.mp4",
		"2026/03/19/20260319_190000.mp4",
	})
	if err != nil {
		t.Fatalf("Delete returned error: %v", err)
	}
	if result.Deleted != 2 {
		t.Fatalf("expected 2 deleted recordings, got %d", result.Deleted)
	}

	if _, err := os.Stat(first); !os.IsNotExist(err) {
		t.Fatalf("expected first recording to be deleted, got err=%v", err)
	}
	if _, err := os.Stat(second); err != nil {
		t.Fatalf("expected second recording to remain, got err=%v", err)
	}
	if _, err := os.Stat(third); !os.IsNotExist(err) {
		t.Fatalf("expected third recording to be deleted, got err=%v", err)
	}
}

func TestRecordingServiceSkipsCurrentHourlyRecording(t *testing.T) {
	root := t.TempDir()
	now := time.Date(2026, 3, 20, 17, 30, 0, 0, time.UTC)
	cameraRoot := filepath.Join(root, "cam-1", "2026", "03", "20")
	if err := os.MkdirAll(cameraRoot, 0o755); err != nil {
		t.Fatalf("MkdirAll returned error: %v", err)
	}

	active := filepath.Join(cameraRoot, "20260320_170000.mp4")
	older := filepath.Join(cameraRoot, "20260320_160000.mp4")
	for _, file := range []string{active, older} {
		if err := os.WriteFile(file, []byte("recording"), 0o644); err != nil {
			t.Fatalf("WriteFile returned error: %v", err)
		}
	}

	service := NewRecordingService(RecordingServiceConfig{RecordingsRoot: root, Now: func() time.Time { return now }}, nil)
	result, err := service.Delete(context.Background(), "cam-1", []string{
		"2026/03/20/20260320_170000.mp4",
		"2026/03/20/20260320_160000.mp4",
	})
	if err != nil {
		t.Fatalf("Delete returned error: %v", err)
	}
	if result.Deleted != 1 {
		t.Fatalf("expected 1 deleted recording, got %d", result.Deleted)
	}
	if len(result.Skipped) != 1 || result.Skipped[0] != "2026/03/20/20260320_170000.mp4" {
		t.Fatalf("unexpected skipped recordings: %#v", result.Skipped)
	}
	if _, err := os.Stat(active); err != nil {
		t.Fatalf("expected active recording to remain, got err=%v", err)
	}
	if _, err := os.Stat(older); !os.IsNotExist(err) {
		t.Fatalf("expected older recording to be deleted, got err=%v", err)
	}
}
