import axios from 'axios';
import client from './client';
import type { QueryGroup } from '../components/QueryBuilder';

// Table setting values structure stored in the database
export interface TableSettingValues {
    visibleColumns?: string[];
    columnOrder?: string[];
    columnWidths?: Record<string, number | undefined>;
    textOverflow?: 'ellipsis' | 'wrap';
    filters?: QueryGroup;
}

// Full table setting response from API
export interface TableSetting {
    id: string;
    user_id: string;
    table_name: string;
    module: string;
    values: TableSettingValues;
    created_at: string;
    updated_at: string;
}

// Request payload for saving settings
interface SaveSettingRequest {
    table_name: string;
    values: TableSettingValues;
}

/**
 * Get table settings for a specific module
 * @param module - Unique module identifier (e.g., 'cutoff-list', 'company-list')
 * @returns TableSetting or null if not found
 */
export async function getTableSettings(module: string): Promise<TableSetting | null> {
    try {
        const response = await client.get<TableSetting | null>(`/api/table-settings/${module}`);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            return null;
        }
        console.warn('Failed to get table settings:', error);
        return null;
    }
}

/**
 * Save table settings for a specific module
 * @param module - Unique module identifier
 * @param tableName - DataTable identifier (e.g., 'cutoffs', 'companies')
 * @param values - Settings values to save
 */
export async function saveTableSettings(
    module: string,
    tableName: string,
    values: TableSettingValues
): Promise<TableSetting | null> {
    try {
        const payload: SaveSettingRequest = {
            table_name: tableName,
            values,
        };
        const response = await client.post<TableSetting>(`/api/table-settings/${module}`, payload);
        return response.data;
    } catch (error) {
        console.warn('Failed to save table settings:', error);
        return null;
    }
}

/**
 * Delete table settings for a specific module (reset to defaults)
 * @param module - Unique module identifier
 */
export async function deleteTableSettings(module: string): Promise<boolean> {
    try {
        await client.delete(`/api/table-settings/${module}`);
        return true;
    } catch (error) {
        console.warn('Failed to delete table settings:', error);
        return false;
    }
}
