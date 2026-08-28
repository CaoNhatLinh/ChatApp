import apiClient from '@/shared/api/apiClient';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '../types/auth.types';

interface CanonicalUserResponse {
    userId: string;
    username: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    accountStatus: string;
}

interface CanonicalAuthResponse {
    accessToken: string;
    user: CanonicalUserResponse;
}

const toUser = (user: CanonicalUserResponse): User => ({
    userId: user.userId,
    userName: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
});

export const login = async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<CanonicalAuthResponse>('/auth/login', data);
    return {
        token: response.data.accessToken,
        userId: response.data.user.userId,
        userName: response.data.user.username,
        displayName: response.data.user.displayName,
        avatarUrl: response.data.user.avatarUrl,
    };
};

export const refreshAccessToken = async (): Promise<string> => {
    const response = await apiClient.post<CanonicalAuthResponse>('/auth/refresh');
    return response.data.accessToken;
};

export const register = async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<CanonicalUserResponse>('/auth/register', {
        ...data,
        authProvider: 'LOCAL',
    });
    return toUser(response.data);
};

export const getCurrentUser = async (): Promise<User> => {
    const response = await apiClient.get<CanonicalUserResponse>('/auth/me');
    return toUser(response.data);
};

export const logout = async (): Promise<void> => {
    await apiClient.post('/auth/logout');
};
