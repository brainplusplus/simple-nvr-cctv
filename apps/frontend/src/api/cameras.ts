import client from './client';
import type { FieldDefinition } from '../types/filters';

export interface RecordingSetting {
    camera_id?: string;
    mode: string;
    retention_type: 'days' | 'size';
    retention_value: number;
}

export interface CameraRuntimeStatus {
    state: 'online' | 'offline' | 'stopped' | 'error' | string;
    pid?: number;
    last_start_at?: string;
    last_exit_at?: string;
    last_segment_at?: string;
    last_error?: string;
    restart_count: number;
    next_restart_at?: string;
}

export interface CameraResponse {
    id: string;
    name: string;
    rtsp_url: string;
    enabled: boolean;
    created_at: string;
    updated_at: string;
    recording_setting: RecordingSetting;
    runtime_status: CameraRuntimeStatus;
}

export interface CreateCameraRequest {
    name: string;
    rtsp_url: string;
    enabled: boolean;
    recording_setting: RecordingSetting;
}

export type UpdateCameraRequest = CreateCameraRequest;

export interface RecordingFile {
    camera_id: string;
    filename: string;
    relative_path: string;
    playback_url: string;
    timestamp: string;
    size: number;
    duration_seconds?: number;
}

export interface WebRTCSessionDescription {
    type: 'offer' | 'answer';
    sdp: string;
}

export interface DeleteRecordingsResponse {
    deleted: number;
    skipped?: string[];
}

function getMediaToken(): string | null {
    return typeof window === 'undefined' ? null : localStorage.getItem('token');
}

export function appendMediaToken(url: string, params?: Record<string, string | number>): string {
    const [path, query = ''] = url.split('?');
    const searchParams = new URLSearchParams(query);
    const token = getMediaToken();

    if (token) {
        searchParams.set('token', token);
    }

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            searchParams.set(key, String(value));
        });
    }

    const nextQuery = searchParams.toString();
    return nextQuery ? `${path}?${nextQuery}` : path;
}

function relayStreamName(cameraId: string): string {
    return `camera_${cameraId}`;
}

function browserRelayStreamName(cameraId: string): string {
    return `${relayStreamName(cameraId)}_browser`;
}

export const camerasApi = {
    list: async (): Promise<CameraResponse[]> => {
        const response = await client.get<CameraResponse[]>('/api/cameras');
        return response.data;
    },

    get: async (id: string): Promise<CameraResponse> => {
        const response = await client.get<CameraResponse>(`/api/cameras/${id}`);
        return response.data;
    },

    create: async (data: CreateCameraRequest): Promise<CameraResponse> => {
        const response = await client.post<CameraResponse>('/api/cameras', data);
        return response.data;
    },

    update: async (id: string, data: UpdateCameraRequest): Promise<CameraResponse> => {
        const response = await client.put<CameraResponse>(`/api/cameras/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<{ message: string }> => {
        const response = await client.delete<{ message: string }>(`/api/cameras/${id}`);
        return response.data;
    },

    listRecordings: async (cameraId: string): Promise<RecordingFile[]> => {
        const response = await client.get<RecordingFile[]>('/api/recordings', { params: { camera_id: cameraId } });
        return response.data;
    },

    deleteRecordings: async (cameraId: string, paths: string[]): Promise<DeleteRecordingsResponse> => {
        const response = await client.delete<DeleteRecordingsResponse>('/api/recordings', {
            params: { camera_id: cameraId },
            data: { paths },
        });
        return response.data;
    },

    createWebRTCAnswer: async (cameraId: string, offer: WebRTCSessionDescription): Promise<WebRTCSessionDescription> => {
        const response = await client.post<WebRTCSessionDescription>(`/go2rtc/api/webrtc?src=${browserRelayStreamName(cameraId)}`, offer);
        return response.data;
    },

    getSnapshotUrl: (cameraId: string, version?: number): string => appendMediaToken(`/api/cameras/${cameraId}/snapshot`, version === undefined ? undefined : { v: version }),
    getLivePlaylistUrl: (cameraId: string): string => `/go2rtc/api/stream.m3u8?src=${browserRelayStreamName(cameraId)}&mp4`,
    getPlaybackUrl: (url: string): string => appendMediaToken(url),
};

export const cameraFields: FieldDefinition[] = [
    { name: 'name', label: 'columns.name', type: 'string' },
    { name: 'enabled', label: 'status.enabled', type: 'boolean' },
    { name: 'recording_setting.retention_type', label: 'retention.type', type: 'select', options: ['days', 'size'] },
    { name: 'runtime_status.state', label: 'status.health', type: 'select', options: ['online', 'offline', 'stopped', 'error'] },
];

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
