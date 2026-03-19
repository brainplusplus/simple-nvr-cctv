package handlers

import (
	"context"
	"net/http"

	"simple-nvr-cctv/internal/services"

	"github.com/labstack/echo/v4"
)

type CameraHandler struct {
	service services.CameraServiceAPI
}

func NewCameraHandler(service services.CameraServiceAPI) *CameraHandler {
	return &CameraHandler{service: service}
}

func (h *CameraHandler) List(c echo.Context) error {
	ctx := context.Background()
	cameras, err := h.service.List(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, cameras)
}

func (h *CameraHandler) Get(c echo.Context) error {
	ctx := context.Background()
	camera, err := h.service.Get(ctx, c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Camera not found"})
	}
	return c.JSON(http.StatusOK, camera)
}

func (h *CameraHandler) Create(c echo.Context) error {
	ctx := context.Background()
	var req services.CreateCameraInput
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}
	camera, err := h.service.Create(ctx, req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusCreated, camera)
}

func (h *CameraHandler) Update(c echo.Context) error {
	ctx := context.Background()
	var req services.UpdateCameraInput
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}
	camera, err := h.service.Update(ctx, c.Param("id"), req)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, camera)
}

func (h *CameraHandler) Delete(c echo.Context) error {
	ctx := context.Background()
	if err := h.service.Delete(ctx, c.Param("id")); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "Camera deleted successfully"})
}
