package email

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"os"

	"simple-nvr-cctv/internal/infrastructure"
	"simple-nvr-cctv/internal/utils"
)

// EmailAuthRepository handles auth-related email composition and sending
type EmailAuthRepository struct {
	smtp *infrastructure.SmtpClient
}

// NewEmailAuthRepository creates a new EmailAuthRepository
func NewEmailAuthRepository(smtp *infrastructure.SmtpClient) *EmailAuthRepository {
	return &EmailAuthRepository{smtp: smtp}
}

// IsConfigured returns true if SMTP is properly configured
func (r *EmailAuthRepository) IsConfigured() bool {
	return r.smtp.IsConfigured()
}

// SendOtpEmail sends an OTP verification email for login
func (r *EmailAuthRepository) SendOtpEmail(ctx context.Context, toEmail, otpCode, userName, langCode string) error {
	if !r.IsConfigured() {
		return fmt.Errorf("SMTP is not configured")
	}

	locale, err := utils.LoadLocale("email_verify_otp.json")
	if err != nil {
		return fmt.Errorf("failed to load locale: %w", err)
	}

	vars := map[string]string{
		"name": userName,
		"code": otpCode,
	}
	trans := utils.GetTranslations(locale, langCode, vars)

	templatePath := "email/verify-otp.html"
	tmpl, err := template.ParseFiles(templatePath)
	if err != nil {
		return fmt.Errorf("failed to load email template: %w", err)
	}

	data := struct {
		UserName string
		OtpCode  string
		AppName  string
		Trans    map[string]string
	}{
		UserName: userName,
		OtpCode:  otpCode,
		AppName:  os.Getenv("APP_NAME"),
		Trans:    trans,
	}

	if data.AppName == "" {
		data.AppName = "SaaS Application"
	}

	var body bytes.Buffer
	if err := tmpl.Execute(&body, data); err != nil {
		return fmt.Errorf("failed to render email template: %w", err)
	}

	subject := data.Trans["subject"]
	if subject == "" {
		subject = fmt.Sprintf("Login Verification Code - %s", data.AppName)
	}

	return r.smtp.SendEmail(toEmail, subject, body.String())
}

// SendForgotPasswordEmail sends a forgot password email with the reset token
func (r *EmailAuthRepository) SendForgotPasswordEmail(ctx context.Context, toEmail, token, userName, langCode string) error {
	if !r.IsConfigured() {
		return fmt.Errorf("SMTP is not configured")
	}

	locale, err := utils.LoadLocale("email_forgot_password.json")
	if err != nil {
		return fmt.Errorf("failed to load locale: %w", err)
	}

	vars := map[string]string{
		"name":  userName,
		"token": token,
	}
	trans := utils.GetTranslations(locale, langCode, vars)

	templatePath := "email/forgot-password.html"
	tmpl, err := template.ParseFiles(templatePath)
	if err != nil {
		return fmt.Errorf("failed to load email template: %w", err)
	}

	data := struct {
		UserName string
		Token    string
		AppName  string
		Trans    map[string]string
	}{
		UserName: userName,
		Token:    token,
		AppName:  os.Getenv("APP_NAME"),
		Trans:    trans,
	}

	if data.AppName == "" {
		data.AppName = "SaaS Application"
	}

	var body bytes.Buffer
	if err := tmpl.Execute(&body, data); err != nil {
		return fmt.Errorf("failed to render email template: %w", err)
	}

	subject := data.Trans["subject"]
	if subject == "" {
		subject = fmt.Sprintf("Password Reset Request - %s", data.AppName)
	}

	return r.smtp.SendEmail(toEmail, subject, body.String())
}
