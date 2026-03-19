package models

import (
	"time"

	"simple-nvr-cctv/internal/domain/identity"

	"gorm.io/gorm"
)

// User represents a user in the system
type User struct {
	ID                           string     `json:"id" gorm:"primaryKey;type:uuid"`
	Email                        string     `json:"email" gorm:"uniqueIndex;not null"`
	Password                     string     `json:"password,omitempty" gorm:"not null"`
	Name                         string     `json:"name" gorm:"not null"`
	Role                         string     `json:"role"`
	TelegramID                   string     `json:"telegram_id" gorm:"column:telegram_id"`
	PhoneNumber                  string     `json:"phone_number" gorm:"column:phone_number"`
	ForgotPasswordToken          string     `json:"-" gorm:"column:forgot_password_token"`
	ForgotPasswordTokenExpiresAt *time.Time `json:"-" gorm:"column:forgot_password_token_expires_at"`
	OtpToken                     string     `json:"-" gorm:"column:otp_token"`
	OtpTokenExpiresAt            *time.Time `json:"-" gorm:"column:otp_token_expires_at"`
	IsUsingOtp                   bool       `json:"is_using_otp" gorm:"column:is_using_otp;default:false"`
	IsActive                     bool       `json:"is_active" gorm:"default:true"`
	LangCode                     string     `json:"lang_code" gorm:"default:'id'"`
	CreatedAt                    time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt                    time.Time  `json:"updated_at" gorm:"autoUpdateTime"`
}

// BeforeCreate hook to generate UUID before creating
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" && u.Email != "" {
		u.ID = identity.GenerateUserID(u.Email)
	}
	return nil
}

// UserResponse is the user data returned to clients (without password)
type UserResponse struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	Name        string `json:"name"`
	Role        string `json:"role"`
	TelegramID  string `json:"telegram_id,omitempty"`
	PhoneNumber string `json:"phone_number,omitempty"`
	IsUsingOtp  bool   `json:"is_using_otp"`
	IsActive    bool   `json:"is_active"`
	LangCode    string `json:"lang_code"`
}

// ToResponse converts a User to UserResponse (excluding password)
func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:          u.ID,
		Email:       u.Email,
		Name:        u.Name,
		Role:        u.Role,
		TelegramID:  u.TelegramID,
		PhoneNumber: u.PhoneNumber,
		IsUsingOtp:  u.IsUsingOtp,
		IsActive:    u.IsActive,
		LangCode:    u.LangCode,
	}
}

// AllowedUserFilterFields defines whitelist of filterable fields
var AllowedUserFilterFields = map[string]bool{
	"id":         true,
	"email":      true,
	"name":       true,
	"role":       true,
	"is_active":  true,
	"lang_code":  true,
	"created_at": true,
	"updated_at": true,
}
