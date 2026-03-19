import client from './client';

export interface UserResponse {
    id: string;
    email: string;
    name: string;
    role: string;
    telegram_id?: string;
    phone_number?: string;
    is_using_otp: boolean;
    is_active: boolean;
    lang_code: string;
}

export interface CreateUserRequest {
    email: string;
    password: string;
    name: string;
    role: string;
    telegram_id?: string;
    phone_number?: string;
    is_using_otp: boolean;
    is_active: boolean;
    lang_code: string;
}

export interface UpdateUserRequest {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
    telegram_id?: string;
    phone_number?: string;
    is_using_otp: boolean;
    is_active: boolean;
    lang_code?: string;
}

export const usersApi = {
    getAll: async (): Promise<UserResponse[]> => {
        const response = await client.get<UserResponse[]>('/api/users');
        return response.data;
    },

    getById: async (id: string): Promise<UserResponse> => {
        const response = await client.get<UserResponse>(`/api/users/${id}`);
        return response.data;
    },

    create: async (data: CreateUserRequest): Promise<UserResponse> => {
        const response = await client.post<UserResponse>('/api/users', data);
        return response.data;
    },

    update: async (id: string, data: UpdateUserRequest): Promise<UserResponse> => {
        const response = await client.put<UserResponse>(`/api/users/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<{ message: string }> => {
        const response = await client.delete<{ message: string }>(`/api/users/${id}`);
        return response.data;
    },
};

// User field definitions for filter builder
import type { FieldDefinition } from '../types/filters';
export const userFields: FieldDefinition[] = [
    { name: 'name', label: 'columns.name', type: 'string' },
    { name: 'email', label: 'columns.email', type: 'string' },
    { name: 'role', label: 'columns.role', type: 'select', options: ['user', 'admin'] },
    { name: 'is_active', label: 'status.active', type: 'boolean' },
];
