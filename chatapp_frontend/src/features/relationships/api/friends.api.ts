import apiClient from '@/shared/api/apiClient';
import type { UserDTO } from '@/entities/user/model/user.types';
import type { FriendshipStatus } from '../model/friend.types';

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
    status: FriendshipStatus;
    userDetails: UserDTO[];
}

export interface BlockStatusResponse {
    hasBlocked: boolean;
    isBlockedBy: boolean;
}


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

export const getReceivedRequests = async (page = 0, size = 30): Promise<PaginatedResponse<FriendRequestsResponse>> => {
    const response = await apiClient.get<SpringPage<FriendRequestsResponse> | FriendRequestsResponse>('/friends/requests/received', {
        params: { page, size }
    });
    return mapToPaginatedResponse(response.data, page, size);
};

export const getSentRequests = async (page = 0, size = 30): Promise<PaginatedResponse<FriendRequestsResponse>> => {
    const response = await apiClient.get<SpringPage<FriendRequestsResponse> | FriendRequestsResponse[]>('/friends/requests/sent', {
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

export const getUsersByStatus = async (
    status: FriendshipStatus,
    page = 0,
    size = 30,
): Promise<FriendRequestsResponse> => {
    const response = await apiClient.get<FriendRequestsResponse>(`/friends/status/${status}`, {
        params: { page, size },
    });
    return response.data;
};

export const getMutualFriends = async (
    otherUserId: string,
    page = 0,
    size = 30,
): Promise<PaginatedResponse<FriendDTO>> => {
    const response = await apiClient.get<SpringPage<FriendDTO>>(`/friends/mutual/${otherUserId}`, {
        params: { page, size },
    });
    return mapToPaginatedResponse(response.data, page, size);
};

export const blockFriend = async (friendId: string): Promise<void> => {
    await apiClient.post(`/friends/block/${friendId}`);
};

export const unblockFriend = async (friendId: string): Promise<void> => {
    await apiClient.post(`/friends/unblock/${friendId}`);
};

export const checkBlockStatus = async (otherUserId: string): Promise<BlockStatusResponse> => {
    const response = await apiClient.get<BlockStatusResponse>(`/friends/check-block/${otherUserId}`);
    return response.data;
};

export interface FriendApi {
    sendRequest: (friendId: string) => Promise<void>;
    getReceivedRequests: (page?: number, size?: number) => Promise<FriendRequestsResponse>;
    getUsersByStatus: (status: FriendshipStatus, page?: number, size?: number) => Promise<FriendRequestsResponse>;
    acceptFriendRequest: (senderId: string) => Promise<void>;
    rejectFriendRequest: (senderId: string) => Promise<void>;
    blockFriend: (friendId: string) => Promise<void>;
    unblockFriend: (friendId: string) => Promise<void>;
    checkBlockStatus: (otherUserId: string) => Promise<BlockStatusResponse>;
    getMutualFriends: (otherUserId: string, page?: number, size?: number) => Promise<PaginatedResponse<FriendDTO>>;
    unfriend: (friendId: string) => Promise<void>;
}

export const friendApi: FriendApi = {
    sendRequest: async (friendId: string) => sendFriendRequest(friendId),
    getReceivedRequests: async (page = 0, size = 30) => {
        const response = await getReceivedRequests(page, size);
        return response.content[0] ?? { userId: '', status: 'PENDING', userDetails: [] };
    },
    getUsersByStatus: async (status: FriendshipStatus, page = 0, size = 30) => getUsersByStatus(status, page, size),
    acceptFriendRequest: async (senderId: string) => acceptFriendRequest(senderId),
    rejectFriendRequest: async (senderId: string) => rejectFriendRequest(senderId),
    blockFriend,
    unblockFriend,
    checkBlockStatus,
    getMutualFriends,
    unfriend,
};
