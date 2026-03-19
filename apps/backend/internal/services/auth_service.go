package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"time"

	"simple-nvr-cctv/internal/models"
	db "simple-nvr-cctv/internal/repositories/db"
	emailRepo "simple-nvr-cctv/internal/repositories/email"
	"simple-nvr-cctv/internal/utils"

	"github.com/golang-jwt/jwt/v5"
)

// AuthService handles authentication business logic
type AuthService struct {
	userRepo      *db.UserRepository
	emailAuthRepo *emailRepo.EmailAuthRepository
}

// NewAuthService creates a new AuthService
func NewAuthService(userRepo *db.UserRepository, emailAuthRepo *emailRepo.EmailAuthRepository) *AuthService {
	return &AuthService{
		userRepo:      userRepo,
		emailAuthRepo: emailAuthRepo,
	}
}

// LoginRequest represents the login request body
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginResponse represents the login response
type LoginResponse struct {
	Token       string               `json:"token,omitempty"`
	User        *models.UserResponse `json:"user,omitempty"`
	RequiresOtp bool                 `json:"requires_otp,omitempty"`
	Email       string               `json:"email,omitempty"`
	Message     string               `json:"message,omitempty"`
}

// ChangePasswordRequest represents the change password request
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

// ForgotPasswordRequest represents the forgot password request
type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

// ResetPasswordRequest represents the reset password request
type ResetPasswordRequest struct {
	Token           string `json:"token"`
	NewPassword     string `json:"new_password"`
	ConfirmPassword string `json:"confirm_password"`
}

// Login authenticates a user and returns a JWT token
func (s *AuthService) Login(ctx context.Context, req LoginRequest) (*LoginResponse, error) {
	user, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	if !user.IsActive {
		return nil, fmt.Errorf("account is deactivated")
	}

	if !utils.IsPasswordMatch(req.Password, user.Password) {
		return nil, fmt.Errorf("invalid email or password")
	}

	// If OTP is enabled for this user
	if user.IsUsingOtp {
		otpCode, err := generateOtpCode()
		if err != nil {
			return nil, fmt.Errorf("failed to generate OTP code: %w", err)
		}

		expiresAt := time.Now().UTC().Add(5 * time.Minute)
		user.OtpToken = otpCode
		user.OtpTokenExpiresAt = &expiresAt

		if err := s.userRepo.Update(ctx, user); err != nil {
			return nil, fmt.Errorf("failed to save OTP: %w", err)
		}

		// Send OTP email
		if s.emailAuthRepo.IsConfigured() {
			if err := s.emailAuthRepo.SendOtpEmail(ctx, user.Email, otpCode, user.Name, user.LangCode); err != nil {
				return nil, fmt.Errorf("failed to send OTP email: %w", err)
			}
		}

		return &LoginResponse{
			RequiresOtp: true,
			Email:       user.Email,
			Message:     "OTP code has been sent to your email",
		}, nil
	}

	// Generate JWT token
	token, err := s.GenerateToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	userResponse := user.ToResponse()
	return &LoginResponse{
		Token: token,
		User:  &userResponse,
	}, nil
}

// VerifyOtp verifies the OTP code and returns a JWT token
func (s *AuthService) VerifyOtp(ctx context.Context, email, otpCode string) (*LoginResponse, error) {
	user, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}

	if user.OtpToken == "" || user.OtpTokenExpiresAt == nil {
		return nil, fmt.Errorf("no OTP requested")
	}

	if time.Now().UTC().After(*user.OtpTokenExpiresAt) {
		return nil, fmt.Errorf("OTP has expired")
	}

	if user.OtpToken != otpCode {
		return nil, fmt.Errorf("invalid OTP code")
	}

	// Clear OTP token
	user.OtpToken = ""
	user.OtpTokenExpiresAt = nil
	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to clear OTP token: %w", err)
	}

	token, err := s.GenerateToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	userResponse := user.ToResponse()
	return &LoginResponse{
		Token: token,
		User:  &userResponse,
	}, nil
}

// ChangePassword changes the password for a user
func (s *AuthService) ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	if !utils.IsPasswordMatch(oldPassword, user.Password) {
		return fmt.Errorf("old password is incorrect")
	}

	hashedPassword, err := utils.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	user.Password = hashedPassword
	return s.userRepo.Update(ctx, user)
}

// ForgotPassword generates a reset token and sends it via email
func (s *AuthService) ForgotPassword(ctx context.Context, email string) error {
	user, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		return nil // Silently ignore if user not found (security)
	}

	token, err := generateResetToken()
	if err != nil {
		return fmt.Errorf("failed to generate reset token: %w", err)
	}

	expiresAt := time.Now().UTC().Add(15 * time.Minute)
	user.ForgotPasswordToken = token
	user.ForgotPasswordTokenExpiresAt = &expiresAt

	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to save reset token: %w", err)
	}

	if s.emailAuthRepo.IsConfigured() {
		if err := s.emailAuthRepo.SendForgotPasswordEmail(ctx, user.Email, token, user.Name, user.LangCode); err != nil {
			return fmt.Errorf("failed to send reset email: %w", err)
		}
	}

	return nil
}

// ResetPassword resets the user's password using the reset token
func (s *AuthService) ResetPassword(ctx context.Context, token, newPassword string) error {
	user, err := s.userRepo.FindByForgotPasswordToken(ctx, token)
	if err != nil {
		return fmt.Errorf("invalid or expired reset token")
	}

	if user.ForgotPasswordTokenExpiresAt == nil || time.Now().UTC().After(*user.ForgotPasswordTokenExpiresAt) {
		return fmt.Errorf("reset token has expired")
	}

	hashedPassword, err := utils.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	user.Password = hashedPassword
	user.ForgotPasswordToken = ""
	user.ForgotPasswordTokenExpiresAt = nil

	return s.userRepo.Update(ctx, user)
}

// GenerateToken generates a JWT token for a user
func (s *AuthService) GenerateToken(user *models.User) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "default-jwt-secret-change-me"
	}

	expSeconds := 604800 // 7 days default
	if expStr := os.Getenv("JWT_EXPIRATION_SECONDS"); expStr != "" {
		if val, err := strconv.Atoi(expStr); err == nil {
			expSeconds = val
		}
	}

	claims := jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"role":    user.Role,
		"exp":     time.Now().UTC().Add(time.Duration(expSeconds) * time.Second).Unix(),
		"iat":     time.Now().UTC().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ValidateToken validates a JWT token and returns the claims
func (s *AuthService) ValidateToken(tokenString string) (jwt.MapClaims, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "default-jwt-secret-change-me"
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}

// User CRUD methods (delegating to repository)

// CreateUser creates a new user
func (s *AuthService) CreateUser(ctx context.Context, user *models.User) error {
	return s.userRepo.Create(ctx, user)
}

// UpdateUser updates an existing user
func (s *AuthService) UpdateUser(ctx context.Context, user *models.User) error {
	return s.userRepo.Update(ctx, user)
}

// GetAllUsers returns all users
func (s *AuthService) GetAllUsers(ctx context.Context) ([]models.User, error) {
	return s.userRepo.FindAll(ctx)
}

// GetUserByID returns a user by ID
func (s *AuthService) GetUserByID(ctx context.Context, id string) (*models.User, error) {
	return s.userRepo.FindByID(ctx, id)
}

// GetUserByEmail returns a user by email
func (s *AuthService) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	return s.userRepo.FindByEmail(ctx, email)
}

// GetUserByForgotPasswordToken returns a user by forgot password token
func (s *AuthService) GetUserByForgotPasswordToken(ctx context.Context, token string) (*models.User, error) {
	return s.userRepo.FindByForgotPasswordToken(ctx, token)
}

// DeleteUser deletes a user by ID
func (s *AuthService) DeleteUser(ctx context.Context, id string) error {
	return s.userRepo.Delete(ctx, id)
}

// Helper functions

func generateOtpCode() (string, error) {
	bytes := make([]byte, 3) // 3 bytes = 6 hex chars
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func generateResetToken() (string, error) {
	bytes := make([]byte, 3)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
