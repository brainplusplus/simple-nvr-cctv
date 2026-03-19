package handlers

import (
	"context"
	"net/http"
	"os"
	"strings"

	"simple-nvr-cctv/internal/domain/identity"
	"simple-nvr-cctv/internal/models"
	"simple-nvr-cctv/internal/services"
	"simple-nvr-cctv/internal/utils"

	"github.com/labstack/echo/v4"
)

// UserHandler handles user CRUD endpoints
type UserHandler struct {
	authService *services.AuthService
}

// NewUserHandler creates a new UserHandler
func NewUserHandler(authService *services.AuthService) *UserHandler {
	return &UserHandler{authService: authService}
}

// GetAll handles GET /api/users
func (h *UserHandler) GetAll(c echo.Context) error {
	ctx := context.Background()

	users, err := h.authService.GetAllUsers(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	var responses []models.UserResponse
	for _, user := range users {
		responses = append(responses, user.ToResponse())
	}

	return c.JSON(http.StatusOK, responses)
}

// GetByID handles GET /api/users/:id
func (h *UserHandler) GetByID(c echo.Context) error {
	ctx := context.Background()

	id := c.Param("id")

	user, err := h.authService.GetUserByID(ctx, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "User not found",
		})
	}

	return c.JSON(http.StatusOK, user.ToResponse())
}

// CreateUserRequest represents create user request
type CreateUserRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	Name        string `json:"name"`
	Role        string `json:"role"`
	TelegramID  string `json:"telegram_id"`
	PhoneNumber string `json:"phone_number"`
	IsUsingOTP  bool   `json:"is_using_otp"`
	IsActive    bool   `json:"is_active"`
	LangCode    string `json:"lang_code"`
}

// normalizePhoneNumber normalizes phone number by replacing leading 0 with country code
func normalizePhoneNumber(phone string) string {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return ""
	}

	if strings.HasPrefix(phone, "0") {
		countryCode := os.Getenv("PHONE_COUNTRY_CODE_DEFAULT")
		if countryCode == "" {
			countryCode = "62" // Default to Indonesia
		}
		phone = countryCode + phone[1:]
	}

	return phone
}

// Create handles POST /api/users
func (h *UserHandler) Create(c echo.Context) error {
	ctx := context.Background()

	var req CreateUserRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Email == "" || req.Password == "" || req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Email, password, and name are required",
		})
	}

	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to hash password",
		})
	}

	user := &models.User{
		ID:          identity.GenerateUserID(req.Email),
		Email:       req.Email,
		Password:    hashedPassword,
		Name:        req.Name,
		Role:        req.Role,
		TelegramID:  req.TelegramID,
		PhoneNumber: normalizePhoneNumber(req.PhoneNumber),
		IsUsingOtp:  req.IsUsingOTP,
		IsActive:    req.IsActive,
		LangCode:    req.LangCode,
	}

	if user.LangCode == "" {
		user.LangCode = "en"
	}

	if user.Role == "" {
		user.Role = "user"
	}

	if err := h.authService.CreateUser(ctx, user); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusCreated, user.ToResponse())
}

// UpdateUserRequest represents update user request
type UpdateUserRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	Name        string `json:"name"`
	Role        string `json:"role"`
	TelegramID  string `json:"telegram_id"`
	PhoneNumber string `json:"phone_number"`
	IsUsingOTP  bool   `json:"is_using_otp"`
	IsActive    bool   `json:"is_active"`
	LangCode    string `json:"lang_code"`
}

// Update handles PUT /api/users/:id
func (h *UserHandler) Update(c echo.Context) error {
	ctx := context.Background()

	id := c.Param("id")

	var req UpdateUserRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	user, err := h.authService.GetUserByID(ctx, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "User not found",
		})
	}

	if req.Email != "" {
		user.Email = req.Email
	}
	if req.Password != "" {
		hashedPassword, err := utils.HashPassword(req.Password)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "Failed to hash password",
			})
		}
		user.Password = hashedPassword
	}
	if req.Name != "" {
		user.Name = req.Name
	}
	if req.Role != "" {
		user.Role = req.Role
	}
	user.TelegramID = req.TelegramID
	user.PhoneNumber = normalizePhoneNumber(req.PhoneNumber)
	user.IsUsingOtp = req.IsUsingOTP
	user.IsActive = req.IsActive
	if req.LangCode != "" {
		user.LangCode = req.LangCode
	}

	if err := h.authService.UpdateUser(ctx, user); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, user.ToResponse())
}

// Delete handles DELETE /api/users/:id
func (h *UserHandler) Delete(c echo.Context) error {
	ctx := context.Background()

	id := c.Param("id")

	currentUserID := c.Get("user_id").(string)
	if id == currentUserID {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Cannot delete your own account",
		})
	}

	user, err := h.authService.GetUserByID(ctx, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "User not found",
		})
	}

	user.IsActive = false
	if err := h.authService.UpdateUser(ctx, user); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "User deactivated successfully",
	})
}
