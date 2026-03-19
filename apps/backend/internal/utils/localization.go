package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// LocaleEntry represents a single key's translations
type LocaleEntry map[string]string

// LocaleFile represents the entire JSON file content
type LocaleFile map[string]LocaleEntry

// LoadLocale loads a JSON locale file
func LoadLocale(filename string) (LocaleFile, error) {
	paths := []string{
		fmt.Sprintf("locales/%s", filename),
		fmt.Sprintf("apps/backend/locales/%s", filename),
		fmt.Sprintf("../locales/%s", filename),
	}

	var content []byte
	var err error

	for _, path := range paths {
		content, err = os.ReadFile(path)
		if err == nil {
			break
		}
	}

	if err != nil {
		return nil, fmt.Errorf("failed to load locale file %s: %w", filename, err)
	}

	var localeFile LocaleFile
	if err := json.Unmarshal(content, &localeFile); err != nil {
		return nil, fmt.Errorf("failed to parse locale file %s: %w", filename, err)
	}

	return localeFile, nil
}

// GetTranslations returns a map of [key] -> [translated_string] for the given language
func GetTranslations(localeFile LocaleFile, langCode string, variableMap map[string]string) map[string]string {
	result := make(map[string]string)
	defaultLang := "id"

	if langCode == "" {
		langCode = defaultLang
	}

	for key, translations := range localeFile {
		val, ok := translations[langCode]
		if !ok {
			val, ok = translations[defaultLang]
			if !ok {
				val = translations["en"]
			}
		}

		if len(variableMap) > 0 {
			for varKey, varVal := range variableMap {
				placeholder := fmt.Sprintf("{{%s}}", varKey)
				val = strings.ReplaceAll(val, placeholder, varVal)
			}
		}

		result[key] = val
	}

	return result
}
