package handlers

import (
	"context"
	"net/http"

	"simple-nvr-cctv/internal/services"

	"github.com/labstack/echo/v4"
)

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	authService *services.AuthService
}

// NewAuthHandler creates a new AuthHandler
func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Login handles POST /api/auth/login
func (h *AuthHandler) Login(c echo.Context) error {
	ctx := context.Background()

	var req services.LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Email == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Email and password are required",
		})
	}

	response, err := h.authService.Login(ctx, req)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, response)
}

// GetMe handles GET /api/auth/me
func (h *AuthHandler) GetMe(c echo.Context) error {
	ctx := context.Background()

	userID, ok := c.Get("user_id").(string)
	if !ok || userID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "Unauthorized",
		})
	}

	user, err := h.authService.GetUserByID(ctx, userID)
	if err != nil {
		c.Logger().Errorf("Failed to get user me for ID %s: %v", userID, err)
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "User not found or invalid token",
		})
	}

	return c.JSON(http.StatusOK, user.ToResponse())
}

// VerifyOtpRequest represents verify OTP request
type VerifyOtpRequest struct {
	Email   string `json:"email"`
	OtpCode string `json:"otp_code"`
}

// VerifyOtp handles POST /api/auth/verify-otp
func (h *AuthHandler) VerifyOtp(c echo.Context) error {
	ctx := context.Background()

	var req VerifyOtpRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Email == "" || req.OtpCode == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Email and OTP code are required",
		})
	}

	response, err := h.authService.VerifyOtp(ctx, req.Email, req.OtpCode)
	if err != nil {
		c.Logger().Errorf("[VerifyOtp] Failed for %s: %v", req.Email, err)
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": err.Error(),
		})
	}

	c.Logger().Infof("[VerifyOtp] Successful login for %s", req.Email)
	return c.JSON(http.StatusOK, response)
}

// ChangePassword handles POST /api/auth/change-password
func (h *AuthHandler) ChangePassword(c echo.Context) error {
	ctx := context.Background()

	userID, ok := c.Get("user_id").(string)
	if !ok || userID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "Unauthorized",
		})
	}

	var req services.ChangePasswordRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.OldPassword == "" || req.NewPassword == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Old password and new password are required",
		})
	}

	if err := h.authService.ChangePassword(ctx, userID, req.OldPassword, req.NewPassword); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Password changed successfully",
	})
}

// ForgotPassword handles POST /api/auth/forgot-password
func (h *AuthHandler) ForgotPassword(c echo.Context) error {
	ctx := context.Background()

	var req services.ForgotPasswordRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Email == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Email is required",
		})
	}

	if err := h.authService.ForgotPassword(ctx, req.Email); err != nil {
		c.Logger().Errorf("[ForgotPassword] Error: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "If the email exists, a password reset token has been sent",
	})
}

// ResetPassword handles POST /api/auth/reset-password
func (h *AuthHandler) ResetPassword(c echo.Context) error {
	ctx := context.Background()

	var req services.ResetPasswordRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	if req.Token == "" || req.NewPassword == "" || req.ConfirmPassword == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Token, new password, and confirm password are required",
		})
	}

	if req.NewPassword != req.ConfirmPassword {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Passwords do not match",
		})
	}

	if err := h.authService.ResetPassword(ctx, req.Token, req.NewPassword); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Password has been reset successfully",
	})
}
