import apiClient from '@/shared/api/apiClient';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '../types/auth.types';

export const login = async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    return response.data;
};

export const register = async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<User>('/auth/register', data);
    return response.data;
};

export const getCurrentUser = async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
};

export const logout = async (): Promise<void> => {
    await apiClient.post('/auth/logout');
};
