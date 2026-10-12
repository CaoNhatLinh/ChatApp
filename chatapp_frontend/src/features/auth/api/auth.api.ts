import apiClient from '@/shared/api/apiClient';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '../types/auth.types';

export interface CanonicalUserResponse {
    userId: string;
    username: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    accountStatus: string;
}

export interface CanonicalAuthResponse {
    accessToken: string;
    user: CanonicalUserResponse;
}

export const toUser = (user: CanonicalUserResponse): User => ({
    userId: user.userId,
    userName: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
});

export const toAuthResponse = (response: CanonicalAuthResponse): AuthResponse => ({
    token: response.accessToken,
    userId: response.user.userId,
    userName: response.user.username,
    displayName: response.user.displayName,
    avatarUrl: response.user.avatarUrl,
});

export const login = async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<CanonicalAuthResponse>('/auth/login', data);
    return toAuthResponse(response.data);
};

export const refreshAccessToken = (): Promise<string> => apiClient.refreshAccessToken();

export const register = async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<CanonicalUserResponse>('/auth/register', data);
    return toUser(response.data);
};

export const getCurrentUser = async (): Promise<User> => {
    const response = await apiClient.get<CanonicalUserResponse>('/auth/me');
    return toUser(response.data);
};

export const logout = async (): Promise<void> => {
    await apiClient.post('/auth/logout');
};
