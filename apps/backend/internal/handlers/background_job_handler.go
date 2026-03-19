package handlers

import (
	"context"
	"net/http"

	"simple-nvr-cctv/internal/models"
	"simple-nvr-cctv/internal/services"

	"github.com/labstack/echo/v4"
)

// BackgroundJobHandler handles background job endpoints
type BackgroundJobHandler struct {
	service *services.BackgroundJobService
}

// NewBackgroundJobHandler creates a new BackgroundJobHandler
func NewBackgroundJobHandler(service *services.BackgroundJobService) *BackgroundJobHandler {
	return &BackgroundJobHandler{service: service}
}

// GetAll handles GET /api/background-jobs
func (h *BackgroundJobHandler) GetAll(c echo.Context) error {
	ctx := context.Background()

	jobs, err := h.service.GetAll(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, jobs)
}

// GetActive handles GET /api/background-jobs/active
func (h *BackgroundJobHandler) GetActive(c echo.Context) error {
	ctx := context.Background()

	jobs, err := h.service.GetAllActive(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, jobs)
}

// GetByID handles GET /api/background-jobs/:id
func (h *BackgroundJobHandler) GetByID(c echo.Context) error {
	ctx := context.Background()

	id := c.Param("id")

	job, err := h.service.GetByID(ctx, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Job not found",
		})
	}

	return c.JSON(http.StatusOK, job)
}

// Search handles POST /api/background-jobs/search
func (h *BackgroundJobHandler) Search(c echo.Context) error {
	ctx := context.Background()

	var req models.BackgroundJobSearchRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	result := h.service.Search(ctx, &req)
	return c.JSON(http.StatusOK, result)
}
