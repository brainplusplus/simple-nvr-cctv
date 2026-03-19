package db

import (
	"context"

	"simple-nvr-cctv/internal/models"

	"gorm.io/gorm"
)

// BackgroundJobRepository handles background job data access operations
type BackgroundJobRepository struct {
	db *gorm.DB
}

// NewBackgroundJobRepository creates a new BackgroundJobRepository
func NewBackgroundJobRepository(db *gorm.DB) *BackgroundJobRepository {
	return &BackgroundJobRepository{db: db}
}

// GetAll returns all background jobs
func (r *BackgroundJobRepository) GetAll(ctx context.Context) ([]models.BackgroundJob, error) {
	var jobs []models.BackgroundJob
	if err := r.db.Order("started_at DESC").Find(&jobs).Error; err != nil {
		return nil, err
	}
	return jobs, nil
}

// GetByID returns a background job by ID
func (r *BackgroundJobRepository) GetByID(ctx context.Context, id string) (*models.BackgroundJob, error) {
	var job models.BackgroundJob
	if err := r.db.First(&job, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

// GetActiveJob returns the active job of a specific type (status = "started")
func (r *BackgroundJobRepository) GetActiveJob(ctx context.Context, jobType string) (*models.BackgroundJob, error) {
	var job models.BackgroundJob
	err := r.db.Where("type = ? AND status = ?", jobType, "started").First(&job).Error
	if err != nil {
		return nil, err
	}
	return &job, nil
}

// GetAllActive returns all active (started) background jobs
func (r *BackgroundJobRepository) GetAllActive(ctx context.Context) ([]models.BackgroundJob, error) {
	var jobs []models.BackgroundJob
	if err := r.db.Where("status = ?", "started").Find(&jobs).Error; err != nil {
		return nil, err
	}
	return jobs, nil
}

// Create creates a new background job
func (r *BackgroundJobRepository) Create(ctx context.Context, job *models.BackgroundJob) error {
	return r.db.Create(job).Error
}

// Update saves changes to a background job
func (r *BackgroundJobRepository) Update(ctx context.Context, job *models.BackgroundJob) error {
	return r.db.Save(job).Error
}

// UpdateFields updates specific fields of a background job
func (r *BackgroundJobRepository) UpdateFields(ctx context.Context, id string, updates map[string]interface{}) error {
	return r.db.Model(&models.BackgroundJob{}).Where("id = ?", id).Updates(updates).Error
}

// Search searches background jobs with filters, pagination, and sorting
func (r *BackgroundJobRepository) Search(ctx context.Context, req *models.BackgroundJobSearchRequest) *models.BackgroundJobSearchResponse {
	baseQuery := r.db.Model(&models.BackgroundJob{})

	if req.Filter != nil {
		baseQuery = ApplyFilterGroup(baseQuery, req.Filter, models.AllowedBackgroundJobFilterFields)
	}

	dataQuery, total, totalPages := ApplySearchPagination(baseQuery, req.Sort, req.Page, req.Limit, "started_at DESC", nil)

	var results []models.BackgroundJob
	dataQuery.Find(&results)

	return &models.BackgroundJobSearchResponse{
		Data:       results,
		Total:      int(total),
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: totalPages,
	}
}
