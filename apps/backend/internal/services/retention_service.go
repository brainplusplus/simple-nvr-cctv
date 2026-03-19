package services

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"simple-nvr-cctv/internal/models"
)

type RetentionConfig struct {
	Now func() time.Time
}

type RetentionResult struct {
	DeletedFiles int   `json:"deleted_files"`
	FreedBytes   int64 `json:"freed_bytes"`
}

type RetentionService struct {
	now func() time.Time
}

func NewRetentionService(cfg RetentionConfig) *RetentionService {
	nowFn := cfg.Now
	if nowFn == nil {
		nowFn = time.Now
	}
	return &RetentionService{now: nowFn}
}

func (s *RetentionService) ApplyPolicy(cameraRoot string, setting models.RecordingSetting) (RetentionResult, error) {
	files, err := s.listFiles(cameraRoot)
	if err != nil {
		return RetentionResult{}, err
	}

	if setting.RetentionValue <= 0 {
		return RetentionResult{}, nil
	}

	switch setting.RetentionType {
	case models.RetentionTypeDays:
		cutoff := s.now().UTC().AddDate(0, 0, -setting.RetentionValue)
		return s.deleteMatching(files, func(file retentionFile) bool { return file.ModTime.Before(cutoff) })
	case models.RetentionTypeSize:
		return s.applySizePolicy(files, int64(setting.RetentionValue))
	default:
		return RetentionResult{}, fmt.Errorf("unsupported retention type: %s", setting.RetentionType)
	}
}

type retentionFile struct {
	Path    string
	ModTime time.Time
	Size    int64
}

func (s *RetentionService) listFiles(root string) ([]retentionFile, error) {
	files := make([]retentionFile, 0)
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || filepath.Ext(path) != ".mp4" {
			return nil
		}
		files = append(files, retentionFile{Path: path, ModTime: info.ModTime().UTC(), Size: info.Size()})
		return nil
	})
	if os.IsNotExist(err) {
		return nil, nil
	}
	return files, err
}

func (s *RetentionService) deleteMatching(files []retentionFile, match func(retentionFile) bool) (RetentionResult, error) {
	result := RetentionResult{}
	for _, file := range files {
		if !match(file) {
			continue
		}
		if err := os.Remove(file.Path); err != nil {
			return result, err
		}
		result.DeletedFiles++
		result.FreedBytes += file.Size
	}
	return result, nil
}

func (s *RetentionService) applySizePolicy(files []retentionFile, limitBytes int64) (RetentionResult, error) {
	result := RetentionResult{}
	var total int64
	for _, file := range files {
		total += file.Size
	}

	if total <= limitBytes {
		return result, nil
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].ModTime.Before(files[j].ModTime)
	})

	for _, file := range files {
		if total <= limitBytes {
			break
		}
		if err := os.Remove(file.Path); err != nil {
			return result, err
		}
		total -= file.Size
		result.DeletedFiles++
		result.FreedBytes += file.Size
	}

	return result, nil
}
