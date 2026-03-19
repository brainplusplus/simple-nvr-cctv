package utils

import (
	"golang.org/x/crypto/bcrypt"
)

// DefaultPasswordCost is the default bcrypt cost for password hashing
const DefaultPasswordCost = bcrypt.DefaultCost

// HashPassword generates a bcrypt hash from a plain text password.
func HashPassword(password string, cost ...int) (string, error) {
	c := DefaultPasswordCost
	if len(cost) > 0 && cost[0] > 0 {
		c = cost[0]
	}

	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), c)
	if err != nil {
		return "", err
	}
	return string(hashedBytes), nil
}

// VerifyPassword compares a plain text password with a bcrypt hash.
func VerifyPassword(password, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// IsPasswordMatch is a convenience wrapper that returns true if password matches hash.
func IsPasswordMatch(password, hash string) bool {
	return VerifyPassword(password, hash) == nil
}
