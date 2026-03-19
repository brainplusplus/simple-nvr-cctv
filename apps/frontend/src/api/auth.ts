import client from './client';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface User {
    id: string;
    email: string;
    name: string;
    role: string;
}

export interface LoginResponse {
    token: string;
    user: User;
}

export interface OtpRequiredResponse {
    requires_otp: boolean;
    email: string;
    message: string;
}

export interface ChangePasswordRequest {
    old_password: string;
    new_password: string;
}

export interface ForgotPasswordRequest {
    email: string;
}

export interface ResetPasswordRequest {
    token: string;
    new_password: string;
    confirm_password: string;
}

export interface VerifyOtpRequest {
    email: string;
    otp_code: string;
}

export const authApi = {
    login: async (credentials: LoginRequest): Promise<LoginResponse | OtpRequiredResponse> => {
        const response = await client.post<LoginResponse | OtpRequiredResponse>('/api/auth/login', credentials);
        return response.data;
    },

    verifyOtp: async (data: VerifyOtpRequest): Promise<LoginResponse> => {
        const response = await client.post<LoginResponse>('/api/auth/verify-otp', data);
        return response.data;
    },

    getMe: async (): Promise<User> => {
        const response = await client.get<User>('/api/auth/me');
        return response.data;
    },

    changePassword: async (data: ChangePasswordRequest): Promise<{ message: string }> => {
        const response = await client.post<{ message: string }>('/api/auth/change-password', data);
        return response.data;
    },

    forgotPassword: async (data: ForgotPasswordRequest): Promise<{ message: string }> => {
        const response = await client.post<{ message: string }>('/api/auth/forgot-password', data);
        return response.data;
    },

    resetPassword: async (data: ResetPasswordRequest): Promise<{ message: string }> => {
        const response = await client.post<{ message: string }>('/api/auth/reset-password', data);
        return response.data;
    },
};

export function isOtpRequired(response: LoginResponse | OtpRequiredResponse): response is OtpRequiredResponse {
    return (response as OtpRequiredResponse).requires_otp === true;
}
