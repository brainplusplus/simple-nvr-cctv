package utils

import (
	"simple-nvr-cctv/internal/models"
)

// BaseFilter represents a pre-applied filter for referenced datatables
// Example: { Field: "company_id", Operator: "=", Value: "uuid" }
type BaseFilter struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"`
	Value    interface{} `json:"value"`
}

// ReferencedSearchRequestParams contains parameters for building a search request
// with a base filter pre-applied (e.g., company_id for cutoffs in company detail)
type ReferencedSearchRequestParams struct {
	BaseFilter BaseFilter          // The base filter to always apply (e.g., company_id)
	UserFilter *models.FilterGroup // User-defined filters from QueryBuilder
	Sort       []models.SortField  // Sorting configuration
	Page       int                 // Page number
	Limit      int                 // Items per page
}

// BuildReferencedSearchRequest builds a search request with base filter + user filters
//
// This utility is useful when implementing referenced datatables (e.g., cutoffs in company detail page)
// where you need to always apply a base filter (like company_id) and optionally merge with user filters.
//
// Example:
//
//	// In handler for GET /api/companies/:id/cutoffs
//	baseFilter := utils.BaseFilter{
//	    Field:    "company_id",
//	    Operator: "=",
//	    Value:    companyId,
//	}
//	params := utils.ReferencedSearchRequestParams{
//	    BaseFilter: baseFilter,
//	    UserFilter: req.Filter, // From request body
//	    Sort:       req.Sort,
//	    Page:       req.Page,
//	    Limit:      req.Limit,
//	}
//	filterGroup := utils.BuildReferencedFilterGroup(params)
//	// Use filterGroup in service search
func BuildReferencedFilterGroup(params ReferencedSearchRequestParams) *models.FilterGroup {
	// Start with base filter (e.g., company_id)
	baseFilter := models.Filter{
		Field:    params.BaseFilter.Field,
		Operator: params.BaseFilter.Operator,
		Value:    params.BaseFilter.Value,
	}

	filters := []interface{}{baseFilter}

	// Add user filters if any
	if params.UserFilter != nil && len(params.UserFilter.Filters) > 0 {
		filters = append(filters, params.UserFilter.Filters...)
	}

	return &models.FilterGroup{
		Logic:   "AND",
		Filters: filters,
	}
}

// MergeFilterGroups merges multiple filter groups with AND logic
// Useful when you need to combine base filters from multiple sources
func MergeFilterGroups(groups ...*models.FilterGroup) *models.FilterGroup {
	if len(groups) == 0 {
		return &models.FilterGroup{
			Logic:   "AND",
			Filters: []interface{}{},
		}
	}

	if len(groups) == 1 {
		return groups[0]
	}

	// Flatten all filters
	allFilters := []interface{}{}
	for _, group := range groups {
		if group != nil && len(group.Filters) > 0 {
			allFilters = append(allFilters, group.Filters...)
		}
	}

	return &models.FilterGroup{
		Logic:   "AND",
		Filters: allFilters,
	}
}

// ApplyBaseFilterToRequest wraps a search request to include a base filter
// This is a convenience function for common use cases
func ApplyBaseFilterToRequest(
	baseField string,
	baseOperator string,
	baseValue interface{},
	userFilter *models.FilterGroup,
) *models.FilterGroup {
	baseFilter := BaseFilter{
		Field:    baseField,
		Operator: baseOperator,
		Value:    baseValue,
	}

	return BuildReferencedFilterGroup(ReferencedSearchRequestParams{
		BaseFilter: baseFilter,
		UserFilter: userFilter,
	})
}
