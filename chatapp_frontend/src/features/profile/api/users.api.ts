import apiClient from '@/shared/api/apiClient';
import type { UserDTO } from '@/entities/user/model/user.types';

export interface UpdateProfileRequest {
    displayName: string;
    avatarUrl: string;
    nickname: string;
}

interface CanonicalPublicUser {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    accountStatus: string;
    createdAt?: string;
}

interface CanonicalUserSearchPage {
    content: CanonicalPublicUser[];
    nextCursor?: string;
    hasNext: boolean;
}

const toUserDto = (user: CanonicalPublicUser): UserDTO => ({
    userId: user.userId,
    userName: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    status: user.accountStatus,
});

export const searchUsers = async (keyword: string): Promise<UserDTO[]> => {
    const response = await apiClient.get<CanonicalUserSearchPage>('/users/search', {
        params: { q: keyword, limit: 20 }
    });
    return response.data.content.map(toUserDto);
};

export const getUserProfile = async (userId: string): Promise<UserDTO> => {
    const response = await apiClient.get<CanonicalPublicUser>(`/users/${userId}`);
    return toUserDto(response.data);
};

export const updateProfile = async (data: UpdateProfileRequest): Promise<UserDTO> => {
    const response = await apiClient.patch<CanonicalPublicUser>('/users/me', {
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
    });
    return toUserDto(response.data);
};
