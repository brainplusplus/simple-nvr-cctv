// Shared filter types for QueryBuilder and API modules

// Option type for select/multiselect fields
export interface SelectOption {
    value: string;
    label: string;
}

// Field definition type for filter fields
export interface FieldDefinition {
    name: string;
    label: string;
    type: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
    options?: string[] | SelectOption[];  // For select and multiselect types - supports both simple strings and value/label pairs
}

// Filter types
export interface Filter {
    field: string;
    operator: string;
    value: string | number | boolean | string[];
}

export interface FilterGroup {
    logic: 'AND' | 'OR';
    filters: (Filter | FilterGroup)[];
}

export interface SortField {
    field: string;
    direction: 'asc' | 'desc';
}

export interface SearchRequest {
    filter?: FilterGroup;
    sort?: SortField[];
    page?: number;
    limit?: number;
    total_pages?: number;
}

export interface SearchResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

// Filter operators
export const filterOperators = [
    { value: '=', label: 'Equals' },
    { value: '!=', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Not Contains' },
    { value: '>', label: 'Greater Than' },
    { value: '>=', label: 'Greater or Equal' },
    { value: '<', label: 'Less Than' },
    { value: '<=', label: 'Less or Equal' },
];
