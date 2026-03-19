package services

import (
	"context"

	"simple-nvr-cctv/internal/models"
	db "simple-nvr-cctv/internal/repositories/db"
)

// BackgroundJobService handles background job business logic
type BackgroundJobService struct {
	repo *db.BackgroundJobRepository
}

// NewBackgroundJobService creates a new BackgroundJobService
func NewBackgroundJobService(repo *db.BackgroundJobRepository) *BackgroundJobService {
	return &BackgroundJobService{repo: repo}
}

// GetAll returns all background jobs
func (s *BackgroundJobService) GetAll(ctx context.Context) ([]models.BackgroundJob, error) {
	return s.repo.GetAll(ctx)
}

// GetByID returns a background job by ID
func (s *BackgroundJobService) GetByID(ctx context.Context, id string) (*models.BackgroundJob, error) {
	return s.repo.GetByID(ctx, id)
}

// GetActiveJob returns the active job of a specific type
func (s *BackgroundJobService) GetActiveJob(ctx context.Context, jobType string) (*models.BackgroundJob, error) {
	return s.repo.GetActiveJob(ctx, jobType)
}

// GetAllActive returns all currently active jobs
func (s *BackgroundJobService) GetAllActive(ctx context.Context) ([]models.BackgroundJob, error) {
	return s.repo.GetAllActive(ctx)
}

// Create creates a new background job
func (s *BackgroundJobService) Create(ctx context.Context, job *models.BackgroundJob) error {
	return s.repo.Create(ctx, job)
}

// Update updates a background job
func (s *BackgroundJobService) Update(ctx context.Context, job *models.BackgroundJob) error {
	return s.repo.Update(ctx, job)
}

// UpdateFields updates specific fields of a background job
func (s *BackgroundJobService) UpdateFields(ctx context.Context, id string, updates map[string]interface{}) error {
	return s.repo.UpdateFields(ctx, id, updates)
}

// Search searches background jobs with filters, pagination, and sorting
func (s *BackgroundJobService) Search(ctx context.Context, req *models.BackgroundJobSearchRequest) *models.BackgroundJobSearchResponse {
	return s.repo.Search(ctx, req)
}
