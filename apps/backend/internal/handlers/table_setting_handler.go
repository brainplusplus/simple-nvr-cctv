package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"simple-nvr-cctv/internal/models"
	"simple-nvr-cctv/internal/services"

	"github.com/labstack/echo/v4"
)

// TableSettingHandler handles table settings endpoints
type TableSettingHandler struct {
	service *services.TableSettingService
}

// NewTableSettingHandler creates a new TableSettingHandler
func NewTableSettingHandler(service *services.TableSettingService) *TableSettingHandler {
	return &TableSettingHandler{service: service}
}

// Get handles GET /api/table-settings/:module
func (h *TableSettingHandler) Get(c echo.Context) error {
	ctx := context.Background()

	userID, ok := c.Get("user_id").(string)
	if !ok || userID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "Unauthorized",
		})
	}

	module := c.Param("module")

	setting, err := h.service.GetByUserAndModule(ctx, userID, module)
	if err != nil {
		return c.JSON(http.StatusOK, nil)
	}

	return c.JSON(http.StatusOK, setting)
}

// SaveTableSettingRequest represents the save table setting request
type SaveTableSettingRequest struct {
	TableName string          `json:"table_name"`
	Values    json.RawMessage `json:"values"`
}

// Save handles POST /api/table-settings/:module
func (h *TableSettingHandler) Save(c echo.Context) error {
	ctx := context.Background()

	userID, ok := c.Get("user_id").(string)
	if !ok || userID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "Unauthorized",
		})
	}

	module := c.Param("module")

	var req SaveTableSettingRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	setting := &models.TableSetting{
		UserID:  userID,
		TblName: req.TableName,
		Module:  module,
		Values:  req.Values,
	}

	if err := h.service.Upsert(ctx, setting); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, setting)
}

// Delete handles DELETE /api/table-settings/:module
func (h *TableSettingHandler) Delete(c echo.Context) error {
	ctx := context.Background()

	userID, ok := c.Get("user_id").(string)
	if !ok || userID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "Unauthorized",
		})
	}

	module := c.Param("module")

	if err := h.service.Delete(ctx, userID, module); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Table settings deleted successfully",
	})
}
