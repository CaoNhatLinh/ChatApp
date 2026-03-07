// src/utils/apiHelpers.ts

import type { MessageResponseDto, MessageQueryParams } from '@/types/message';
import type { ConversationResponseDto } from '@/types/conversation';
import type { UserDTO } from '@/types/user';
import { getMessages, sendMessageHttp } from '@/api/messageApi';
import { getUserProfile, searchUsersNew } from '@/api/userApi';
import { fetchMyConversationsNew, createConversationNew, findDmConversationNew } from '@/api/conversationApi';

// Authentication token management
export const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken') ?? sessionStorage.getItem('authToken');
};

export const setAuthToken = (token: string, persistent = false): void => {
  if (persistent) {
    localStorage.setItem('authToken', token);
  } else {
    sessionStorage.setItem('authToken', token);
  }
};

export const removeAuthToken = (): void => {
  localStorage.removeItem('authToken');
  sessionStorage.removeItem('authToken');
};

// Current user ID management
export const getCurrentUserId = (): string | null => {
  return localStorage.getItem('currentUserId') ?? sessionStorage.getItem('currentUserId');
};

export const setCurrentUserId = (userId: string, persistent = false): void => {
  if (persistent) {
    localStorage.setItem('currentUserId', userId);
  } else {
    sessionStorage.setItem('currentUserId', userId);
  }
};

// API Helper classes
export class MessageApiHelper {
  private token: string;

  constructor(token?: string) {
    this.token = token ?? getAuthToken() ?? '';
  }

  async getConversationMessages(
    conversationId: string,
    params?: MessageQueryParams
  ): Promise<MessageResponseDto[]> {
    return getMessages(this.token, conversationId, params);
  }

  async sendMessage(
    conversationId: string,
    content: string,
    messageType: 'text' | 'image' = 'text',
    replyTo?: string,
    mentionedUserIds?: string[]
  ): Promise<MessageResponseDto> {
    return sendMessageHttp(this.token, {
      conversationId,
      content,
      messageType,
      replyTo,
      mentionedUserIds,
    });
  }

  async getMessagesBefore(
    conversationId: string,
    beforeDate: string,
    limit = 20
  ): Promise<MessageResponseDto[]> {
    return this.getConversationMessages(conversationId, {
      before: beforeDate,
      limit,
    });
  }

  async getMessagesAfter(
    conversationId: string,
    afterDate: string,
    limit = 20
  ): Promise<MessageResponseDto[]> {
    return this.getConversationMessages(conversationId, {
      after: afterDate,
      limit,
    });
  }
}

export class ConversationApiHelper {
  private token: string;
  private userId: string;

  constructor(token?: string, userId?: string) {
    this.token = token ?? getAuthToken() ?? '';
    this.userId = userId ?? getCurrentUserId() ?? '';
  }

  async getMyConversations(): Promise<ConversationResponseDto[]> {
    return fetchMyConversationsNew(this.token, this.userId);
  }

  async createGroupConversation(
    name: string,
    memberIds: string[],
    description?: string
  ): Promise<ConversationResponseDto> {
    return createConversationNew(this.token, {
      name,
      type: 'group',
      memberIds,
      description,
    });
  }

  async createDirectMessage(
    otherUserId: string,
    name?: string
  ): Promise<ConversationResponseDto> {
    return createConversationNew(this.token, {
      name: name ?? 'Direct Message',
      type: 'dm',
      memberIds: [this.userId, otherUserId],
    });
  }

  async findOrCreateDM(otherUserId: string): Promise<ConversationResponseDto> {
    try {
      // Try to find existing DM first
      return await findDmConversationNew(this.token, this.userId, otherUserId);
    } catch {
      // If not found, create new DM
      return this.createDirectMessage(otherUserId);
    }
  }
}

export class UserApiHelper {

  async getUserById(userId: string): Promise<UserDTO> {
    return getUserProfile(userId);
  }

  async searchUsers(query: string): Promise<UserDTO[]> {
    return searchUsersNew(query);
  }

  async getUsersByIds(userIds: string[]): Promise<UserDTO[]> {
    const promises = userIds.map(id => this.getUserById(id));
    return Promise.all(promises);
  }
}

// Utility functions for data transformation
export const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return 'Vua xong';
  } else if (diffMinutes < 60) {
    return `${String(diffMinutes)} phut truoc`;
  } else if (diffHours < 24) {
    return `${String(diffHours)} gio truoc`;
  } else if (diffDays < 7) {
    return `${String(diffDays)} ngay truoc`;
  } else {
    return date.toLocaleDateString('vi-VN');
  }
};

export const truncateMessage = (content: string, maxLength = 50): string => {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength).trim() + '...';
};

export const getDisplayName = (user: UserDTO): string => {
  return user.displayName || user.userName || 'Unknown User';
};

export const getAvatarUrl = (user: UserDTO): string => {
  return user.avatarUrl || '/default-avatar.png';
};

// Error handling helpers
export const isApiError = (error: unknown): error is { message: string; status?: number } => {
  if (error !== null && typeof error === 'object' && 'message' in error) {
    return typeof (error as { message: unknown }).message === 'string';
  }
  return false;
};

export { getErrorMessage } from '@/utils/errorHandler';

// Cache helpers for better performance
interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getCachedData = <T>(key: string): T | null => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }
  cache.delete(key);
  return null;
};

export const setCachedData = <T>(key: string, data: T): void => {
  cache.set(key, { data, timestamp: Date.now() });
};

export const clearCache = (): void => {
  cache.clear();
};

// Export instances for easy use
export const messageApi = new MessageApiHelper();
export const conversationApi = new ConversationApiHelper();
export const userApi = new UserApiHelper();
