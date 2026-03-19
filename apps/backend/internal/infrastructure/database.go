package infrastructure

import (
	"fmt"
	"log"
	"net/url"
	"os"
	"strconv"
	"sync"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	gormSchema "gorm.io/gorm/schema"
)

var (
	db   *gorm.DB
	once sync.Once
)

// InitDB initializes the database connection
func InitDB() (*gorm.DB, error) {
	var initErr error

	once.Do(func() {
		host := os.Getenv("DB_HOST")
		port := os.Getenv("DB_PORT")
		user := os.Getenv("DB_USER")
		password := os.Getenv("DB_PASSWORD")
		dbName := os.Getenv("DB_NAME")
		schema := os.Getenv("DB_SCHEMA")
		sslMode := os.Getenv("DB_SSL_MODE")
		driver := os.Getenv("DB_DRIVER")

		// Validate required vars
		if host == "" || port == "" || user == "" || password == "" || dbName == "" {
			initErr = fmt.Errorf("missing required DB environment variables")
			return
		}

		// Validate driver
		if driver != "postgres" && driver != "" {
			initErr = fmt.Errorf("unsupported DB_DRIVER: %s (only 'postgres' is supported)", driver)
			return
		}

		// Defaults
		if schema == "" {
			schema = "public"
		}
		if sslMode == "" {
			sslMode = "disable"
		}

		log.Printf("Connecting to database %s on %s:%s (schema: %s, ssl: %s)...", dbName, host, port, schema, sslMode)

		// Configure GORM logger based on environment
		logLevel := logger.Warn
		if os.Getenv("DEBUG") == "true" {
			logLevel = logger.Info
		}

		dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s&search_path=%s",
			url.QueryEscape(user),
			url.QueryEscape(password),
			host,
			port,
			dbName,
			sslMode,
			schema,
		)

		var err error
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger: logger.Default.LogMode(logLevel),
			NamingStrategy: gormSchema.NamingStrategy{
				TablePrefix:   schema + ".",
				SingularTable: false,
			},
			// Use UTC for all auto-generated timestamps (created_at, updated_at)
			NowFunc: func() time.Time {
				return time.Now().UTC()
			},
		})
		if err != nil {
			initErr = fmt.Errorf("failed to connect to database: %w", err)
			return
		}

		// Create schema if it doesn't exist
		if err := db.Exec("CREATE SCHEMA IF NOT EXISTS " + schema).Error; err != nil {
			initErr = fmt.Errorf("failed to create schema: %w", err)
			return
		}

		log.Printf("Using schema: %s", schema)

		// Get underlying sql.DB for connection pool settings
		sqlDB, err := db.DB()
		if err != nil {
			initErr = fmt.Errorf("failed to get underlying sql.DB: %w", err)
			return
		}

		// Set connection pool settings from environment (with defaults)
		maxIdleConns := 10
		if maxIdleStr := os.Getenv("DB_MAX_IDLE_CONNS"); maxIdleStr != "" {
			if val, err := strconv.Atoi(maxIdleStr); err == nil && val > 0 {
				maxIdleConns = val
			}
		}
		sqlDB.SetMaxIdleConns(maxIdleConns)

		maxOpenConns := 100
		if maxOpenStr := os.Getenv("DB_MAX_OPEN_CONNS"); maxOpenStr != "" {
			if val, err := strconv.Atoi(maxOpenStr); err == nil && val > 0 {
				maxOpenConns = val
			}
		}
		sqlDB.SetMaxOpenConns(maxOpenConns)

		connMaxLifetime := 5 * time.Minute
		if lifetimeStr := os.Getenv("DB_CONN_MAX_LIFETIME"); lifetimeStr != "" {
			if lifetime, err := strconv.Atoi(lifetimeStr); err == nil && lifetime > 0 {
				connMaxLifetime = time.Duration(lifetime) * time.Second
			}
		}
		sqlDB.SetConnMaxLifetime(connMaxLifetime)

		connMaxIdleTime := 1 * time.Minute
		if idleTimeStr := os.Getenv("DB_CONN_MAX_IDLE_TIME"); idleTimeStr != "" {
			if idleTime, err := strconv.Atoi(idleTimeStr); err == nil && idleTime > 0 {
				connMaxIdleTime = time.Duration(idleTime) * time.Second
			}
		}
		sqlDB.SetConnMaxIdleTime(connMaxIdleTime)

		log.Printf("Database connected successfully (MaxOpen: %d, MaxIdle: %d, MaxLifetime: %v, MaxIdleTime: %v)",
			maxOpenConns, maxIdleConns, connMaxLifetime, connMaxIdleTime)
	})

	return db, initErr
}

// GetDB returns the database instance
func GetDB() *gorm.DB {
	return db
}

// AutoMigrate runs auto-migration for all models
func AutoMigrate(models ...interface{}) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}

	for _, model := range models {
		if err := db.AutoMigrate(model); err != nil {
			return fmt.Errorf("failed to migrate %T: %w", model, err)
		}
		log.Printf("Migrated model: %T", model)
	}

	return nil
}

// CloseDB closes the database connection
func CloseDB() error {
	if db == nil {
		return nil
	}

	sqlDB, err := db.DB()
	if err != nil {
		return err
	}

	return sqlDB.Close()
}
