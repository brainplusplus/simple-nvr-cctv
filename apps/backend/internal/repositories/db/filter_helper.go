package db

import (
	"encoding/json"
	"fmt"
	"strings"

	"simple-nvr-cctv/internal/models"

	"gorm.io/gorm"
)

// ApplyFilterGroup applies a FilterGroup to a GORM query using the provided allowed fields map
func ApplyFilterGroup(query *gorm.DB, group *models.FilterGroup, allowedFields map[string]bool) *gorm.DB {
	if group == nil || len(group.Filters) == 0 {
		return query
	}

	isOr := strings.ToUpper(group.Logic) == "OR"
	var conditions []string
	var args []interface{}

	for _, f := range group.Filters {
		filterBytes, _ := json.Marshal(f)

		// Try to parse as FilterGroup (nested)
		var subGroup models.FilterGroup
		if err := json.Unmarshal(filterBytes, &subGroup); err == nil && subGroup.Logic != "" {
			continue
		}

		// Parse as Filter
		var filter models.Filter
		if err := json.Unmarshal(filterBytes, &filter); err == nil && filter.Field != "" {
			if !allowedFields[filter.Field] {
				continue
			}

			condition, arg := BuildFilterCondition(&filter)
			if condition != "" {
				conditions = append(conditions, condition)
				args = append(args, arg...)
			}
		}
	}

	if len(conditions) > 0 {
		joiner := " AND "
		if isOr {
			joiner = " OR "
		}
		combinedCondition := strings.Join(conditions, joiner)
		query = query.Where(combinedCondition, args...)
	}

	return query
}

// BuildFilterCondition builds a WHERE condition from a Filter
func BuildFilterCondition(filter *models.Filter) (string, []interface{}) {
	field := filter.Field
	value := filter.Value

	switch filter.Operator {
	case "=":
		return fmt.Sprintf("%s = ?", field), []interface{}{value}
	case "!=":
		return fmt.Sprintf("%s != ?", field), []interface{}{value}
	case "contains":
		return fmt.Sprintf("LOWER(%s) LIKE LOWER(?)", field), []interface{}{fmt.Sprintf("%%%v%%", value)}
	case "not_contains":
		return fmt.Sprintf("LOWER(%s) NOT LIKE LOWER(?)", field), []interface{}{fmt.Sprintf("%%%v%%", value)}
	case ">":
		return fmt.Sprintf("%s > ?", field), []interface{}{value}
	case ">=":
		return fmt.Sprintf("%s >= ?", field), []interface{}{value}
	case "<":
		return fmt.Sprintf("%s < ?", field), []interface{}{value}
	case "<=":
		return fmt.Sprintf("%s <= ?", field), []interface{}{value}
	case "in":
		return fmt.Sprintf("%s IN (?)", field), []interface{}{value}
	case "not_in":
		return fmt.Sprintf("%s NOT IN (?)", field), []interface{}{value}
	}
	return "", nil
}

// ApplySearchPagination applies sorting and pagination to a query
func ApplySearchPagination(query *gorm.DB, sort []models.SortField, page, limit int, defaultSort string, allowedFields map[string]bool) (*gorm.DB, int64, int) {
	var total int64
	countQuery := query.Session(&gorm.Session{})
	countQuery.Count(&total)

	dataQuery := query.Session(&gorm.Session{})

	// Apply sorting
	if len(sort) > 0 {
		for _, sf := range sort {
			if allowedFields == nil || allowedFields[sf.Field] {
				direction := "ASC"
				if strings.ToLower(sf.Direction) == "desc" {
					direction = "DESC"
				}
				dataQuery = dataQuery.Order(fmt.Sprintf("%s %s", sf.Field, direction))
			}
		}
	} else if defaultSort != "" {
		dataQuery = dataQuery.Order(defaultSort)
	}

	// Apply pagination
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}

	offset := (page - 1) * limit
	totalPages := (int(total) + limit - 1) / limit

	dataQuery = dataQuery.Offset(offset).Limit(limit)

	return dataQuery, total, totalPages
}
