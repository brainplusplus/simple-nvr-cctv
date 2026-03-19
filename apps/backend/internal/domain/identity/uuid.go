package identity

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"

	"github.com/google/uuid"
)

// Namespace UUID for generating deterministic UUIDs (v5)
var namespaceUUID = uuid.MustParse("6ba7b810-9dad-11d1-80b4-00c04fd430c8")

// GenerateUUID generates a deterministic UUID v5 based on group name and value
func GenerateUUID(groupName, value string) string {
	name := fmt.Sprintf("%s:%s", groupName, value)
	id := uuid.NewSHA1(namespaceUUID, []byte(name))
	return id.String()
}

// GenerateUUIDFromHash generates a UUID-like string from SHA1 hash
func GenerateUUIDFromHash(groupName, value string) string {
	name := fmt.Sprintf("%s:%s", groupName, value)
	hash := sha1.Sum([]byte(name))
	hexStr := hex.EncodeToString(hash[:16])

	return fmt.Sprintf("%s-%s-%s-%s-%s",
		hexStr[0:8],
		hexStr[8:12],
		hexStr[12:16],
		hexStr[16:20],
		hexStr[20:32],
	)
}
