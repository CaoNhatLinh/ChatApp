// src/api/presenceApi.ts

import api from '@/lib/axios';
import axios from 'axios';

import type { UserPresence, PresenceResponse } from '@/types/presence';

/**
 * Get presence of all friends
 */
export const getFriendsPresence = async (): Promise<PresenceResponse> => {
  const response = await api.get<PresenceResponse>('/presence/friends');
  return response.data;
};

/**
 * Get presence of conversation members
 */
export const getConversationPresence = async (conversationId: string): Promise<PresenceResponse> => {
  const response = await api.get<PresenceResponse>(`/presence/conversation/${conversationId}`);
  return response.data;
};

/**
 * Get presence of a specific user
 */
export const getUserPresence = async (userId: string): Promise<UserPresence | null> => {
  try {
    const response = await api.get<UserPresence>(`/presence/user/${userId}`);
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

/**
 * Get presence of multiple users
 */
export const getBatchPresence = async (userIds: string[]): Promise<PresenceResponse> => {
  const response = await api.post<PresenceResponse>('/presence/batch-get', userIds);
  return response.data;
};

/**
 * Check if a user is online
 */
export const checkUserOnline = async (userId: string): Promise<boolean> => {
  const response = await api.get<{ isOnline: boolean }>(`/presence/check/${userId}`);
  return response.data.isOnline;
};

/**
 * Get all online users
 */
export const getAllOnlineUsers = async (): Promise<string[]> => {
  const response = await api.get<string[]>('/presence/online');
  return response.data;
};

/**
 * Subscribe to presence updates for users
 */
export const subscribePresence = async (userIds: string[]): Promise<void> => {
  await api.post('/presence/subscribe', userIds);
};

/**
 * Unsubscribe from presence updates for users
 */
export const unsubscribePresence = async (userIds: string[]): Promise<void> => {
  await api.post('/presence/unsubscribe', userIds);
};
