import apiClient from '@/shared/api/apiClient';
import type { UserDTO } from '@/entities/user/model/user.types';

export interface UpdateProfileRequest {
    displayName: string;
    avatarUrl: string;
    nickname: string;
}

export const searchUsers = async (keyword: string): Promise<UserDTO[]> => {
    try {
        const response = await apiClient.get<UserDTO | UserDTO[]>('/users/search', {
            params: { q: keyword }
        });

        if (!response.data) {
            return [];
        }

        return Array.isArray(response.data) ? response.data : [response.data];
    } catch (error) {
        console.error('Error searching users:', error);
        return [];
    }
};

export const searchUsersNew = searchUsers;

export const getUserProfile = async (userId: string): Promise<UserDTO> => {
    const response = await apiClient.get<UserDTO>(`/users/profile/${userId}`);
    return response.data;
};

export const updateProfile = async (data: UpdateProfileRequest): Promise<UserDTO> => {
    const response = await apiClient.patch<UserDTO>('/users/profile', data);
    return response.data;
};
