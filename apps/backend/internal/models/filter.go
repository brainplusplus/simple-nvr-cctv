package models

// FilterGroup represents a group of filters with AND/OR logic
type FilterGroup struct {
	Logic   string        `json:"logic"`
	Filters []interface{} `json:"filters"`
}

// Filter represents a single filter condition
type Filter struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"`
	Value    interface{} `json:"value"`
}

// SortField represents a sort field with direction
type SortField struct {
	Field     string `json:"field"`
	Direction string `json:"direction"`
}
