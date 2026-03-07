// src/hooks/useFriends.ts

import { useState, useEffect, useCallback } from 'react';
import { friendApi } from '@/api/friendApi';
import { useAuthStore } from '@/store/authStore';
import type { FriendDetails } from '@/types/friend';

interface UseFriendsOptions {
  autoFetch?: boolean;
}
export const useFriends = (options: UseFriendsOptions = {}) => {
  const { autoFetch = true } = options;
  const user = useAuthStore((state) => state.user);

  const [friends, setFriends] = useState<FriendDetails[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendDetails[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    if (!user?.userId) return;

    setLoading(true);
    setError(null);

    try {
      const [friendsData, sentData, receivedData] = await Promise.all([
        friendApi.getFriendsPresence(),
        friendApi.getSentRequests(user.userId),
        friendApi.getReceivedRequests(user.userId),
      ]) as [unknown, unknown, unknown];

      setFriends(
        (Array.isArray(friendsData) ? friendsData : [friendsData])
          .filter(Boolean)
          .map((item: FriendDetails) => ({
            userId: item.userId,
            status: item.status,
            userDetails: item.userDetails,
          }))
      );
      setSentRequests(
        (Array.isArray(sentData) ? sentData : [sentData])
          .filter(Boolean)
          .map((item: FriendDetails) => ({
            userId: item.userId,
            status: item.status,
            userDetails: item.userDetails,
          }))
      );
      setReceivedRequests(
        (Array.isArray(receivedData) ? receivedData : [receivedData])
          .filter(Boolean)
          .map((item: FriendDetails) => ({
            userId: item.userId,
            status: item.status,
            userDetails: item.userDetails,
          }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch friends');
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) return [];

    try {
      const response = await friendApi.searchUsers(query) as { data?: FriendDetails[] };
      return response.data ?? [];
    } catch (err) {
      console.error('Failed to search users:', err instanceof Error ? err.message : err);
      return [];
    }
  }, []);

  const sendFriendRequest = useCallback(async (receiverId: string) => {
    if (!user?.userId) throw new Error('User not authenticated');

    try {
      await friendApi.sendRequest(user.userId, receiverId);
      // Refresh sent requests
      const sentData = await friendApi.getSentRequests(user.userId);
      setSentRequests(Array.isArray(sentData) ? sentData : [sentData].filter(Boolean));
      return true;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to send friend request');
    }
  }, [user?.userId]);

  const acceptFriendRequest = useCallback(async (senderId: string) => {
    if (!user?.userId) throw new Error('User not authenticated');

    try {
      await friendApi.acceptFriendRequest(senderId, user.userId);
      await fetchFriends();
      return true;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to accept friend request');
    }
  }, [user?.userId, fetchFriends]);

  const rejectFriendRequest = useCallback(async (senderId: string) => {
    if (!user?.userId) throw new Error('User not authenticated');

    try {
      await friendApi.rejectFriendRequest(senderId, user.userId);
      const receivedData = await friendApi.getReceivedRequests(user.userId);
      setReceivedRequests(Array.isArray(receivedData) ? receivedData : [receivedData].filter(Boolean));
      return true;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to reject friend request');
    }
  }, [user?.userId]);

  const updateRelationship = useCallback(async (friendId: string, status: 'BLOCKED' | 'UNFRIENDED') => {
    try {
      await friendApi.updateRelationship(friendId, status);
      await fetchFriends();
      return true;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update relationship');
    }
  }, [fetchFriends]);

  useEffect(() => {
    if (autoFetch && user?.userId) {
      void fetchFriends();
    }
  }, [autoFetch, user?.userId, fetchFriends]);

  return {
    friends,
    sentRequests,
    receivedRequests,
    loading,
    error,
    fetchFriends,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    updateRelationship,
  };
};
