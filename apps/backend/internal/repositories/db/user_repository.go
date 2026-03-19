package db

import (
	"context"

	"simple-nvr-cctv/internal/models"

	"gorm.io/gorm"
)

// UserRepository handles user data access operations
type UserRepository struct {
	db *gorm.DB
}

// NewUserRepository creates a new UserRepository
func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

// FindByID returns a user by ID
func (r *UserRepository) FindByID(ctx context.Context, id string) (*models.User, error) {
	var user models.User
	if err := r.db.First(&user, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByEmail returns a user by email
func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	if err := r.db.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByForgotPasswordToken returns a user by forgot password token
func (r *UserRepository) FindByForgotPasswordToken(ctx context.Context, token string) (*models.User, error) {
	var user models.User
	if err := r.db.Where("forgot_password_token = ?", token).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// FindAll returns all users
func (r *UserRepository) FindAll(ctx context.Context) ([]models.User, error) {
	var users []models.User
	if err := r.db.Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

// Create creates a new user
func (r *UserRepository) Create(ctx context.Context, user *models.User) error {
	return r.db.Create(user).Error
}

// Update saves changes to an existing user
func (r *UserRepository) Update(ctx context.Context, user *models.User) error {
	return r.db.Save(user).Error
}

// Delete deletes a user by ID
func (r *UserRepository) Delete(ctx context.Context, id string) error {
	return r.db.Delete(&models.User{}, "id = ?", id).Error
}
