import apiClient from '@/shared/api/apiClient';
import type { UserDTO } from '@/entities/user/model/user.types';
import type { FriendshipStatus } from '../model/friend.types';

interface CanonicalFriendUserSummary {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    accountStatus: string;
}

export interface FriendshipStatusResponse {
    userId: string;
    status: FriendshipStatus;
    userDetails: UserDTO[];
}

export interface BlockStatusResponse {
    hasBlocked: boolean;
    isBlockedBy: boolean;
}

const toUserDto = (summary: CanonicalFriendUserSummary): UserDTO => ({
    userId: summary.userId,
    userName: summary.username,
    displayName: summary.displayName,
    avatarUrl: summary.avatarUrl,
    status: summary.accountStatus,
});

const toFriendshipStatus = (response: {
    userId: string;
    status: FriendshipStatus;
    userDetails: CanonicalFriendUserSummary[];
}): FriendshipStatusResponse => ({
    userId: response.userId,
    status: response.status,
    userDetails: response.userDetails.map(toUserDto),
});

export const getFriends = async (limit = 30): Promise<FriendshipStatusResponse> => {
    const response = await apiClient.get<{
        userId: string;
        status: FriendshipStatus;
        userDetails: CanonicalFriendUserSummary[];
    }>('/friends', { params: { limit } });
    return toFriendshipStatus(response.data);
};

export const getReceivedRequests = async (limit = 30): Promise<FriendshipStatusResponse> => {
    const response = await apiClient.get<{
        userId: string;
        status: FriendshipStatus;
        userDetails: CanonicalFriendUserSummary[];
    }>('/friends/requests/received', { params: { limit } });
    return toFriendshipStatus(response.data);
};

export const getSentRequests = async (limit = 30): Promise<FriendshipStatusResponse> => {
    const response = await apiClient.get<{
        userId: string;
        status: FriendshipStatus;
        userDetails: CanonicalFriendUserSummary[];
    }>('/friends/requests/sent', { params: { limit } });
    return toFriendshipStatus(response.data);
};

export const sendFriendRequest = async (recipientId: string): Promise<void> => {
    await apiClient.post('/friends/request', { recipientId });
};

export const acceptFriendRequest = async (friendId: string): Promise<void> => {
    await apiClient.put('/friends/accept', { friendId });
};

export const rejectFriendRequest = async (friendId: string): Promise<void> => {
    await apiClient.put('/friends/reject', { friendId });
};

export const cancelFriendRequest = async (recipientId: string): Promise<void> => {
    await apiClient.delete(`/friends/requests/${recipientId}`);
};

export const unfriend = async (friendId: string): Promise<void> => {
    await apiClient.delete(`/friends/${friendId}`);
};

export const getUsersByStatus = async (
    status: FriendshipStatus,
    limit = 30,
): Promise<FriendshipStatusResponse> => {
    const response = await apiClient.get<{
        userId: string;
        status: FriendshipStatus;
        userDetails: CanonicalFriendUserSummary[];
    }>(`/friends/status/${status}`, {
        params: { limit },
    });
    return toFriendshipStatus(response.data);
};

export const getMutualFriends = async (
    otherUserId: string,
    limit = 30,
): Promise<UserDTO[]> => {
    const response = await apiClient.get<CanonicalFriendUserSummary[]>(`/friends/mutual/${otherUserId}`, {
        params: { limit },
    });
    return response.data.map(toUserDto);
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
    cancelRequest: (recipientId: string) => Promise<void>;
    getReceivedRequests: (limit?: number) => Promise<FriendshipStatusResponse>;
    getUsersByStatus: (status: FriendshipStatus, limit?: number) => Promise<FriendshipStatusResponse>;
    acceptFriendRequest: (senderId: string) => Promise<void>;
    rejectFriendRequest: (senderId: string) => Promise<void>;
    blockFriend: (friendId: string) => Promise<void>;
    unblockFriend: (friendId: string) => Promise<void>;
    checkBlockStatus: (otherUserId: string) => Promise<BlockStatusResponse>;
    getMutualFriends: (otherUserId: string, limit?: number) => Promise<UserDTO[]>;
    unfriend: (friendId: string) => Promise<void>;
}

export const friendApi: FriendApi = {
    sendRequest: async (friendId: string) => sendFriendRequest(friendId),
    cancelRequest: async (recipientId: string) => cancelFriendRequest(recipientId),
    getReceivedRequests: async (limit = 30) => getReceivedRequests(limit),
    getUsersByStatus: async (status: FriendshipStatus, limit = 30) => getUsersByStatus(status, limit),
    acceptFriendRequest: async (senderId: string) => acceptFriendRequest(senderId),
    rejectFriendRequest: async (senderId: string) => rejectFriendRequest(senderId),
    blockFriend,
    unblockFriend,
    checkBlockStatus,
    getMutualFriends,
    unfriend,
};
