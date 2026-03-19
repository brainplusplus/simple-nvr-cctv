import client from './client';
import type { SearchRequest, SearchResponse } from '../types/filters';

export interface BackgroundJob {
    id: string;
    type: string;
    triggered_by: string;
    total_progress_data: number;
    total_data: number;
    total_progress_page: number;
    total_page: number;
    started_at: string | null;
    expired_at: string | null;
    finished_at: string | null;
    error_at: string | null;
    error_message: string;
    status: 'started' | 'finished' | 'error' | 'expired';
    created_at: string;
    updated_at: string;
}

export interface ActiveJobResponse {
    active: boolean;
    job?: BackgroundJob;
}

export interface AllActiveJobsResponse {
    jobs: BackgroundJob[];
}

export const backgroundJobsApi = {
    getAll: async (): Promise<BackgroundJob[]> => {
        const response = await client.get<BackgroundJob[]>('/api/background-jobs');
        return response.data;
    },

    search: async (request: SearchRequest): Promise<SearchResponse<BackgroundJob>> => {
        const response = await client.post<SearchResponse<BackgroundJob>>('/api/background-jobs/search', request);
        return response.data;
    },

    getById: async (id: string): Promise<BackgroundJob> => {
        const response = await client.get<BackgroundJob>(`/api/background-jobs/${id}`);
        return response.data;
    },

    getActive: async (type: string): Promise<ActiveJobResponse> => {
        const response = await client.get<ActiveJobResponse>(`/api/background-jobs/active/${type}`);
        return response.data;
    },

    getAllActive: async (): Promise<BackgroundJob[]> => {
        const response = await client.get<AllActiveJobsResponse>('/api/background-jobs/active');
        return response.data.jobs || [];
    },
};

// Field definitions for filter builder
import type { FieldDefinition } from '../types/filters';

export const backgroundJobFields: FieldDefinition[] = [
    { name: 'id', label: 'id', type: 'string' },
    { name: 'type', label: 'type', type: 'select', options: ['pemeriksaan_button', 'pemeriksaan_cron', 'pengucapan_button', 'pengucapan_cron', 'upload_cutoff', 'sync_dispute_taxes'] },
    { name: 'triggered_by', label: 'triggered_by', type: 'select', options: ['button', 'cron'] },
    { name: 'status', label: 'status', type: 'select', options: ['started', 'finished', 'error'] },
    { name: 'total_progress_page', label: 'progress', type: 'number' },
    { name: 'total_data', label: 'total_data', type: 'number' },
    { name: 'started_at', label: 'started_at', type: 'date' },
    { name: 'finished_at', label: 'finished_at', type: 'date' },
    { name: 'error_message', label: 'error_message', type: 'string' },
];
