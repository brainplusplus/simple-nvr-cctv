package middleware

import (
	"net/http"
	"strings"

	"simple-nvr-cctv/internal/services"

	"github.com/labstack/echo/v4"
)

// AuthMiddleware validates JWT tokens from the Authorization header
func AuthMiddleware(authService *services.AuthService) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			tokenString, ok := extractToken(c)
			if !ok {
				return c.JSON(http.StatusUnauthorized, map[string]string{
					"error": "Authorization token is required",
				})
			}

			claims, err := authService.ValidateToken(tokenString)
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{
					"error": "Invalid or expired token",
				})
			}

			// Set user info in context
			if userID, ok := claims["user_id"].(string); ok {
				c.Set("user_id", userID)
			}
			if email, ok := claims["email"].(string); ok {
				c.Set("email", email)
			}
			if role, ok := claims["role"].(string); ok {
				c.Set("role", role)
			}

			return next(c)
		}
	}
}

func extractToken(c echo.Context) (string, bool) {
	authHeader := strings.TrimSpace(c.Request().Header.Get("Authorization"))
	if authHeader != "" {
		tokenString := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		if tokenString == authHeader || tokenString == "" {
			return "", false
		}
		return tokenString, true
	}

	queryToken := strings.TrimSpace(c.QueryParam("token"))
	if queryToken != "" {
		return queryToken, true
	}

	return "", false
}
