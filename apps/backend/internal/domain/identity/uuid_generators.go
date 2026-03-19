package identity

// Model-specific UUID generators

// GenerateUserID generates a deterministic UUID for a user based on email
func GenerateUserID(email string) string {
	return GenerateUUID("users", email)
}

// GenerateTableSettingID generates a deterministic UUID for a table setting
func GenerateTableSettingID(userID, tableName, module string) string {
	return GenerateUUID("table_settings", userID+tableName+module)
}
