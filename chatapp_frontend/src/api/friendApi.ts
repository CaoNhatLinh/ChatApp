import api from '@/lib/axios';
import type { FriendDetails } from '@/types/friend';
import type { PresenceResponse } from '@/types/presence';

// Export individual functions for easier imports
export const getFriends = async () => {
  const { data } = await api.get<FriendDetails[]>('/friends');
  return data;
};

export const friendApi = {
  // Tìm kiếm user
  searchUsers: async (query: string) => {
    const { data } = await api.get<{ data: FriendDetails[] }>(`/friends/search?q=${query}`);
    return data;
  },

  sendRequest: async (senderId: string, receiverId: string) => {
    const { data } = await api.post<FriendDetails>('/friends/request', { senderId, receiverId });
    return data;
  },

  getUsersByStatus: async (userId: string, status: string) => {
    const { data } = await api.get<FriendDetails>(`/friends/user/${userId}/status/${status}`);
    return data;
  },
  getSentRequests: async (userId: string) => {
    const { data } = await api.get<FriendDetails>(`/friends/requests/sent/${userId}`);
    return data;
  },

  // Lấy danh sách bạn bè
  getFriends: async () => {
    const { data } = await api.get<FriendDetails[]>('/friends');
    return data;
  },

  getFriendsPresence: async (): Promise<PresenceResponse> => {
    const response = await api.get<PresenceResponse>('/presence/friends');
    return response.data;
  },
  getReceivedRequests: async (userId: string) => {
    const { data } = await api.get<FriendDetails>(`/friends/requests/received/${userId}`);
    return data;
  },

  acceptFriendRequest: async (senderId: string, receiverId: string) => {
    const { data } = await api.put<FriendDetails>(`/friends/accept`, { senderId, receiverId });
    return data;
  },
  rejectFriendRequest: async (senderId: string, receiverId: string) => {
    const { data } = await api.put<FriendDetails>('/friends/reject', { senderId, receiverId });
    return data;
  },


  updateRelationship: async (friendId: string, status: 'BLOCKED' | 'UNFRIENDED') => {
    const { data } = await api.put<FriendDetails>('/friends/relationship', { friendId, status });
    return data;
  },

  blockFriend: async (friendId: string) => {
    const { data } = await api.post<void>(`/friends/block/${friendId}`);
    return data;
  },

  unblockFriend: async (friendId: string) => {
    const { data } = await api.post<void>(`/friends/unblock/${friendId}`);
    return data;
  },

  checkBlockStatus: async (otherUserId: string) => {
    const { data } = await api.get<{ hasBlocked: boolean; isBlockedBy: boolean }>(`/friends/check-block/${otherUserId}`);
    return data;
  }
};