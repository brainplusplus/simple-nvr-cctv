package main

import (
	"log"
	"os"

	"simple-nvr-cctv/internal/infrastructure"
	"simple-nvr-cctv/internal/models"
	"simple-nvr-cctv/internal/routes"
	"simple-nvr-cctv/internal/utils"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"gorm.io/gorm"
)

func main() {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize database
	db, err := infrastructure.InitDB()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer infrastructure.CloseDB()

	// Auto-migrate all models
	if err := infrastructure.AutoMigrate(
		&models.User{},
		&models.TableSetting{},
		&models.BackgroundJob{},
		&models.Camera{},
		&models.RecordingSetting{},
	); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// Seed initial user if needed
	if err := seedInitialUser(db); err != nil {
		log.Printf("Failed to seed initial user: %v", err)
	}

	e := echo.New()

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"http://localhost:3002", "http://localhost:7777"},
		AllowMethods: []string{echo.GET, echo.POST, echo.PUT, echo.DELETE, echo.OPTIONS},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
	}))
	// Allow large file uploads (configurable via BODY_LIMIT env, default 100M)
	bodyLimit := os.Getenv("BODY_LIMIT")
	if bodyLimit == "" {
		bodyLimit = "100M"
	}
	e.Use(middleware.BodyLimit(bodyLimit))

	// Setup routes with database
	routes.SetupRoutes(e, db)

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	// Start server (bind to 0.0.0.0 for Docker container access)
	log.Printf("Starting server on port %s", port)
	e.Logger.Fatal(e.Start(":" + port))
}

// seedInitialUser creates a default admin user if no users exist
func seedInitialUser(db *gorm.DB) error {
	var count int64
	if err := db.Model(&models.User{}).Count(&count).Error; err != nil {
		return err
	}

	if count > 0 {
		return nil
	}

	log.Println("No users found, creating default admin user...")

	email := os.Getenv("ADMIN_EMAIL")
	if email == "" {
		email = "admin@example.com"
	}

	password := os.Getenv("ADMIN_PASSWORD")
	if password == "" {
		password = "admin123"
	}

	hashedPassword, err := utils.HashPassword(password)
	if err != nil {
		return err
	}

	admin := models.User{
		Email:    email,
		Password: hashedPassword,
		Name:     "Admin User",
		Role:     "admin",
		IsActive: true,
	}

	if err := db.Create(&admin).Error; err != nil {
		return err
	}

	log.Printf("Created default admin user: %s / %s", email, password)
	return nil
}
