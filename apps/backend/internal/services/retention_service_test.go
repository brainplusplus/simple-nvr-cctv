package services

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"simple-nvr-cctv/internal/models"
)

func TestRetentionServiceDeletesFilesOlderThanConfiguredDays(t *testing.T) {
	now := time.Date(2026, 3, 19, 12, 0, 0, 0, time.UTC)
	root := t.TempDir()
	cameraRoot := filepath.Join(root, "cam-days")

	oldFile := createRetentionTestFile(t, cameraRoot, "2026", "03", "10", "old.mp4", 32, now.AddDate(0, 0, -9))
	newFile := createRetentionTestFile(t, cameraRoot, "2026", "03", "18", "new.mp4", 32, now.AddDate(0, 0, -1))

	service := NewRetentionService(RetentionConfig{Now: func() time.Time { return now }})

	result, err := service.ApplyPolicy(cameraRoot, models.RecordingSetting{RetentionType: models.RetentionTypeDays, RetentionValue: 7})
	if err != nil {
		t.Fatalf("ApplyPolicy returned error: %v", err)
	}

	if result.DeletedFiles != 1 {
		t.Fatalf("expected one file deleted, got %d", result.DeletedFiles)
	}

	if _, err := os.Stat(oldFile); !os.IsNotExist(err) {
		t.Fatalf("expected old file to be deleted, stat err = %v", err)
	}

	if _, err := os.Stat(newFile); err != nil {
		t.Fatalf("expected new file to remain, stat err = %v", err)
	}
}

func TestRetentionServiceDeletesOldestFilesUntilUnderSizeLimit(t *testing.T) {
	now := time.Date(2026, 3, 19, 12, 0, 0, 0, time.UTC)
	root := t.TempDir()
	cameraRoot := filepath.Join(root, "cam-size")

	oldest := createRetentionTestFile(t, cameraRoot, "2026", "03", "19", "000000.mp4", 80, now.Add(-3*time.Hour))
	middle := createRetentionTestFile(t, cameraRoot, "2026", "03", "19", "000500.mp4", 70, now.Add(-2*time.Hour))
	newest := createRetentionTestFile(t, cameraRoot, "2026", "03", "19", "001000.mp4", 60, now.Add(-1*time.Hour))

	service := NewRetentionService(RetentionConfig{Now: func() time.Time { return now }})

	result, err := service.ApplyPolicy(cameraRoot, models.RecordingSetting{RetentionType: models.RetentionTypeSize, RetentionValue: 100})
	if err != nil {
		t.Fatalf("ApplyPolicy returned error: %v", err)
	}

	if result.DeletedFiles != 2 {
		t.Fatalf("expected two files deleted, got %d", result.DeletedFiles)
	}

	if _, err := os.Stat(oldest); !os.IsNotExist(err) {
		t.Fatalf("expected oldest file deleted, stat err = %v", err)
	}

	if _, err := os.Stat(middle); !os.IsNotExist(err) {
		t.Fatalf("expected middle file deleted, stat err = %v", err)
	}

	if _, err := os.Stat(newest); err != nil {
		t.Fatalf("expected newest file kept, stat err = %v", err)
	}
}

func createRetentionTestFile(t *testing.T, root string, parts ...interface{}) string {
	t.Helper()

	if len(parts) < 6 {
		t.Fatalf("invalid test file parts")
	}

	year := parts[0].(string)
	month := parts[1].(string)
	day := parts[2].(string)
	name := parts[3].(string)
	size := parts[4].(int)
	modTime := parts[5].(time.Time)

	dir := filepath.Join(root, year, month, day)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("MkdirAll returned error: %v", err)
	}

	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, make([]byte, size), 0o644); err != nil {
		t.Fatalf("WriteFile returned error: %v", err)
	}

	if err := os.Chtimes(path, modTime, modTime); err != nil {
		t.Fatalf("Chtimes returned error: %v", err)
	}

	return path
}
