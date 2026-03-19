import axios from 'axios';

declare global {
    interface Window {
        __RUNTIME_CONFIG__?: {
            API_URL?: string;
        };
    }
}

export const API_BASE_URL = window.__RUNTIME_CONFIG__?.API_URL ?? import.meta.env.VITE_API_URL ?? '';

const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

client.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default client;
