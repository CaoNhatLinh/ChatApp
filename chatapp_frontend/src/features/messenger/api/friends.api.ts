import apiClient from '@/common/lib/api-client';
import type { User } from '@/features/auth/types/auth.types';

export interface PaginatedResponse<T> {
    content: T[];
    hasNext: boolean;
    number: number;
    size: number;
}

export interface SpringPage<T> {
    content: T[];
    hasNext?: boolean;
    last?: boolean;
    number?: number;
    size?: number;
    totalElements?: number;
    totalPages?: number;
}

export interface FriendDTO {
    friendId: string;
    username: string; // Backend uses 'username' for FriendDTO
    displayName: string;
    avatarUrl: string;
    friendsSince: string;
    isOnline: boolean;
}

export interface FriendRequestsResponse {
    userId: string;
    status: string;
    userDetails: User[]; // User in auth.types uses 'userName'
}

// Helper function to map various backend formats to our consistent PaginatedResponse
const mapToPaginatedResponse = <T>(
    data: SpringPage<T> | T[] | T | null,
    page: number,
    size: number
): PaginatedResponse<T> => {
    if (!data) {
        return { content: [], hasNext: false, number: page, size };
    }

    if (Array.isArray(data)) {
        return {
            content: data,
            hasNext: false,
            number: page,
            size: data.length
        };
    }

    // Check if it's a Spring Page/Slice format
    if ('content' in (data as object) && Array.isArray((data as SpringPage<T>).content)) {
        const paged = data as SpringPage<T>;
        return {
            content: paged.content,
            hasNext: paged.hasNext !== undefined ? paged.hasNext : !(paged.last ?? true),
            number: paged.number ?? page,
            size: paged.size ?? size
        };
    }

    // Must be a single item
    return {
        content: [(data as T)],
        hasNext: false,
        number: page,
        size: 1
    };
};

export const getFriends = async (page = 0, size = 30): Promise<PaginatedResponse<FriendDTO>> => {
    const response = await apiClient.get<SpringPage<FriendDTO> | FriendDTO[]>('/friends/', {
        params: { page, size }
    });
    return mapToPaginatedResponse(response.data, page, size);
};

export const getReceivedRequests = async (userId: string, page = 0, size = 30): Promise<PaginatedResponse<FriendRequestsResponse>> => {
    const response = await apiClient.get<SpringPage<FriendRequestsResponse> | FriendRequestsResponse>(`/friends/requests/received/${userId}`, {
        params: { page, size }
    });
    return mapToPaginatedResponse(response.data, page, size);
};

export const getSentRequests = async (userId: string, page = 0, size = 30): Promise<PaginatedResponse<FriendRequestsResponse>> => {
    const response = await apiClient.get<SpringPage<FriendRequestsResponse> | FriendRequestsResponse[]>(`/friends/requests/sent/${userId}`, {
        params: { page, size }
    });
    return mapToPaginatedResponse(response.data, page, size);
};

export const sendFriendRequest = async (receiverId: string): Promise<void> => {
    await apiClient.post('/friends/request', { receiverId });
};

export const acceptFriendRequest = async (senderId: string): Promise<void> => {
    await apiClient.put('/friends/accept', { senderId });
};

export const rejectFriendRequest = async (senderId: string): Promise<void> => {
    await apiClient.put('/friends/reject', { senderId });
};

export const unfriend = async (friendId: string): Promise<void> => {
    await apiClient.delete(`/friends/${friendId}`);
};
