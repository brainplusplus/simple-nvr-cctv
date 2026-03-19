package infrastructure

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"os"
	"strconv"
	"strings"
)

// SmtpClient handles generic SMTP email sending
type SmtpClient struct {
	host          string
	port          int
	user          string
	password      string
	isSecure      bool
	senderAddress string
	senderName    string
}

// NewSmtpClient creates a new SmtpClient from environment variables
func NewSmtpClient() *SmtpClient {
	port, _ := strconv.Atoi(os.Getenv("SMTP_PORT"))
	if port == 0 {
		port = 587
	}

	encryption := strings.ToLower(os.Getenv("SMTP_ENCRYPTION"))
	if encryption == "" {
		encryption = "tls"
	}
	isSecure := encryption == "ssl"

	senderAddress := os.Getenv("SMTP_SENDER_ADDRESS")
	if senderAddress == "" {
		senderAddress = os.Getenv("SMTP_USER")
	}

	senderName := os.Getenv("SMTP_SENDER_NAME")
	if senderName == "" {
		senderName = "SaaS Application"
	}

	return &SmtpClient{
		host:          os.Getenv("SMTP_HOST"),
		port:          port,
		user:          os.Getenv("SMTP_USER"),
		password:      os.Getenv("SMTP_PASSWORD"),
		isSecure:      isSecure,
		senderAddress: senderAddress,
		senderName:    senderName,
	}
}

// IsConfigured returns true if SMTP is properly configured
func (s *SmtpClient) IsConfigured() bool {
	return s.host != "" && s.user != "" && s.password != ""
}

// GetSenderName returns the sender name
func (s *SmtpClient) GetSenderName() string {
	return s.senderName
}

// GetSenderAddress returns the sender email address
func (s *SmtpClient) GetSenderAddress() string {
	return s.senderAddress
}

// SendEmail sends a raw email message to the specified recipient
func (s *SmtpClient) SendEmail(toEmail, subject, htmlBody string) error {
	if !s.IsConfigured() {
		return fmt.Errorf("SMTP is not configured")
	}

	fromHeader := fmt.Sprintf("%s <%s>", s.senderName, s.senderAddress)
	headers := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n",
		fromHeader, toEmail, subject)

	message := []byte(headers + htmlBody)

	addr := fmt.Sprintf("%s:%d", s.host, s.port)

	if s.isSecure {
		return s.sendWithImplicitTLS(addr, toEmail, message)
	}

	return s.sendWithSTARTTLS(addr, toEmail, message)
}

// sendWithImplicitTLS sends email using implicit TLS connection (for port 465)
func (s *SmtpClient) sendWithImplicitTLS(addr, toEmail string, message []byte) error {
	tlsConfig := &tls.Config{
		ServerName: s.host,
	}

	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("TLS connection failed: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return fmt.Errorf("SMTP client creation failed: %w", err)
	}
	defer client.Close()

	auth := smtp.PlainAuth("", s.user, s.password, s.host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("SMTP auth failed: %w", err)
	}

	if err := client.Mail(s.senderAddress); err != nil {
		return fmt.Errorf("MAIL FROM failed: %w", err)
	}

	if err := client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("RCPT TO failed: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("DATA command failed: %w", err)
	}

	if _, err = w.Write(message); err != nil {
		return fmt.Errorf("message write failed: %w", err)
	}

	if err = w.Close(); err != nil {
		return fmt.Errorf("message close failed: %w", err)
	}

	return client.Quit()
}

// sendWithSTARTTLS sends email using STARTTLS (for port 587 or 25)
func (s *SmtpClient) sendWithSTARTTLS(addr, toEmail string, message []byte) error {
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return fmt.Errorf("SMTP client creation failed: %w", err)
	}
	defer client.Close()

	if err := client.Hello("localhost"); err != nil {
		return fmt.Errorf("EHLO failed: %w", err)
	}

	if ok, _ := client.Extension("STARTTLS"); ok {
		tlsConfig := &tls.Config{
			ServerName: s.host,
		}
		if err := client.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("STARTTLS failed: %w", err)
		}
	}

	auth := smtp.PlainAuth("", s.user, s.password, s.host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("SMTP auth failed: %w", err)
	}

	if err := client.Mail(s.senderAddress); err != nil {
		return fmt.Errorf("MAIL FROM failed: %w", err)
	}

	if err := client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("RCPT TO failed: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("DATA command failed: %w", err)
	}

	if _, err = w.Write(message); err != nil {
		return fmt.Errorf("message write failed: %w", err)
	}

	if err = w.Close(); err != nil {
		return fmt.Errorf("message close failed: %w", err)
	}

	return client.Quit()
}
