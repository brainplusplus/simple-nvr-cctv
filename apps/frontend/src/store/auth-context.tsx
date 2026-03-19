import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, isOtpRequired } from '../api/auth';
import type { User, LoginRequest, VerifyOtpRequest } from '../api/auth';

interface OtpRequiredError extends Error {
    email: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (credentials: LoginRequest) => Promise<void>;
    verifyOtp: (data: VerifyOtpRequest) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setIsLoading(false);
            return;
        }

        try {
            const userData = await authApi.getMe();
            setUser(userData);
        } catch {
            localStorage.removeItem('token');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const login = async (credentials: LoginRequest) => {
        const response = await authApi.login(credentials);

        if (isOtpRequired(response)) {
            const error = new Error('OTP_REQUIRED') as OtpRequiredError;
            error.email = response.email;
            throw error;
        }

        localStorage.setItem('token', response.token);
        setUser(response.user);
    };

    const verifyOtp = async (data: VerifyOtpRequest) => {
        const response = await authApi.verifyOtp(data);
        localStorage.setItem('token', response.token);
        setUser(response.user);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                verifyOtp,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
