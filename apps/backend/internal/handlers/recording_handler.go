package handlers

import (
	"context"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"simple-nvr-cctv/internal/models"
	"simple-nvr-cctv/internal/services"

	"github.com/labstack/echo/v4"
)

type RecordingServiceAPI interface {
	List(ctx context.Context, cameraID string) ([]models.RecordingFile, error)
	OpenFile(ctx context.Context, cameraID, relativePath string) (*os.File, fs.FileInfo, string, error)
	Delete(ctx context.Context, cameraID string, relativePaths []string) (services.DeleteRecordingsResult, error)
	GetSnapshot(ctx context.Context, cameraID string) (*models.SnapshotResult, error)
	OpenLiveFile(ctx context.Context, cameraID, asset string) (*os.File, fs.FileInfo, string, string, error)
	CreateWebRTCAnswer(ctx context.Context, cameraID string, offer services.WebRTCSessionDescription) (*services.WebRTCSessionDescription, error)
}

type deleteRecordingsRequest struct {
	Paths []string `json:"paths"`
}

type RecordingHandler struct {
	service RecordingServiceAPI
}

func NewRecordingHandler(service RecordingServiceAPI) *RecordingHandler {
	return &RecordingHandler{service: service}
}

func (h *RecordingHandler) List(c echo.Context) error {
	ctx := context.Background()
	cameraID := c.QueryParam("camera_id")
	if cameraID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "camera_id is required"})
	}
	recordings, err := h.service.List(ctx, cameraID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, recordings)
}

func (h *RecordingHandler) ServeFile(c echo.Context) error {
	ctx := context.Background()
	cameraID := c.QueryParam("camera_id")
	relPath := c.QueryParam("path")
	file, info, fullPath, err := h.service.OpenFile(ctx, cameraID, relPath)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	defer file.Close()
	http.ServeContent(c.Response(), c.Request(), filepath.Base(fullPath), info.ModTime(), file)
	return nil
}

func (h *RecordingHandler) Delete(c echo.Context) error {
	ctx := context.Background()
	cameraID := c.QueryParam("camera_id")
	if cameraID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "camera_id is required"})
	}

	var request deleteRecordingsRequest
	if err := c.Bind(&request); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid delete payload"})
	}
	if len(request.Paths) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "paths are required"})
	}

	result, err := h.service.Delete(ctx, cameraID, request.Paths)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, result)
}

func (h *RecordingHandler) Snapshot(c echo.Context) error {
	ctx := context.Background()
	result, err := h.service.GetSnapshot(ctx, c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	return c.Blob(http.StatusOK, result.ContentType, result.Content)
}

func (h *RecordingHandler) LivePlaylist(c echo.Context) error {
	ctx := context.Background()
	file, _, _, _, err := h.service.OpenLiveFile(ctx, c.Param("id"), "index.m3u8")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	defer file.Close()

	payload, err := io.ReadAll(file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	manifest := rewritePlaylist(string(payload), c.QueryParam("token"))
	return c.Blob(http.StatusOK, "application/vnd.apple.mpegurl", []byte(manifest))
}

func (h *RecordingHandler) LiveAsset(c echo.Context) error {
	ctx := context.Background()
	asset := c.Param("asset")
	file, info, fullPath, contentType, err := h.service.OpenLiveFile(ctx, c.Param("id"), asset)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}
	defer file.Close()

	c.Response().Header().Set(echo.HeaderContentType, contentType)
	http.ServeContent(c.Response(), c.Request(), filepath.Base(fullPath), info.ModTime(), file)
	return nil
}

func (h *RecordingHandler) WebRTCOffer(c echo.Context) error {
	ctx := context.Background()
	var offer services.WebRTCSessionDescription
	if err := c.Bind(&offer); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid webrtc offer payload"})
	}

	answer, err := h.service.CreateWebRTCAnswer(ctx, c.Param("id"), offer)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, answer)
}

func rewritePlaylist(manifest, token string) string {
	if token == "" {
		return manifest
	}

	lines := strings.Split(manifest, "\n")
	escapedToken := url.QueryEscape(token)
	for index, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		separator := "?"
		if strings.Contains(trimmed, "?") {
			separator = "&"
		}
		lines[index] = trimmed + separator + "token=" + escapedToken
	}
	return strings.Join(lines, "\n")
}
