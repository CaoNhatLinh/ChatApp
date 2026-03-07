// src/api/messageApi.ts

import api from '@/lib/axios';
import { getStompClient } from '@/services/websocketService';
import type {
  MessageResponseDto,
  MessageAttachmentDto,
  SendMessageRequest,
  SendMessageWsPayload,
  MessageQueryParams,
} from '@/types/message';
import type { ApiResponse } from '@/types/api';

/**
 * 📋 Message API Pagination Pattern (Smart Loading):
 * 
 * 1. Initial Load: Automatically loads 20 newest messages when entering a room
 * 2. Load More: getOlderMessages(beforeMessageId) - Gets 30 older messages when scrolling near top
 * 
 * This follows TIMEUUID-based pagination for optimal Cassandra performance.
 * 
 * 🚀 Benefits:
 * - Immediate 20 messages when entering room (good UX)
 * - Load more only when user scrolls near top (saves bandwidth)
 * - Prevents duplicate messages when switching between rooms
 */

// 🔍 Get latest messages from conversation (default 20 messages)
export const getLatestMessages = async (
  token: string,
  conversationId: string,
  limit: number = 20
): Promise<MessageResponseDto[]> => {
  const url = `/messages/conversations/${conversationId}?limit=${limit}`;

  const res = await api.get<ApiResponse<MessageResponseDto[]>>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data.data;
};

// 🔍 Get older messages from conversation (pagination with TIMEUUID)
export const getOlderMessages = async (
  token: string,
  conversationId: string,
  beforeMessageId: string
): Promise<MessageResponseDto[]> => {
  const url = `/messages/conversations/${conversationId}/older?beforeMessageId=${beforeMessageId}`;

  const res = await api.get<ApiResponse<MessageResponseDto[]>>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data.data;
};

// 🔍 Get messages from conversation (legacy - keep for backward compatibility)
export const getMessages = async (
  token: string,
  conversationId: string,
  params?: MessageQueryParams
): Promise<MessageResponseDto[]> => {
  const queryParams = new URLSearchParams();
  if (params?.before) queryParams.append('before', params.before);
  if (params?.after) queryParams.append('after', params.after);
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const url = `/messages/conversations/${conversationId}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  const res = await api.get<ApiResponse<MessageResponseDto[]>>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data.data;
};

// 🟦 Send message via HTTP REST API
export const sendMessageHttp = async (
  token: string,
  payload: SendMessageRequest
): Promise<MessageResponseDto> => {
  const res = await api.post<MessageResponseDto>(
    `/messages`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return res.data;
};

// 🟩 Send message via WebSocket STOMP
export const sendMessageWs = (payload: SendMessageWsPayload) => {
  const client = getStompClient();
  if (!client || !client.connected) {
    console.warn('WebSocket is not connected');
    return;
  }

  client.publish({
    destination: '/app/message.send',
    body: JSON.stringify(payload),
  });
};

// 📝 Send typing indicator
export const sendTyping = (conversationId: string, isTyping: boolean) => {
  const client = getStompClient();
  if (!client || !client.connected) {
    console.warn('WebSocket is not connected');
    return;
  }

  client.publish({
    destination: '/app/typing',
    body: JSON.stringify({
      conversationId,
      isTyping,
    }),
  });
};

// 🟢 Set online status
export const setOnlineStatus = (isOnline: boolean) => {
  const client = getStompClient();
  if (!client || !client.connected) {
    console.warn('WebSocket is not connected');
    return;
  }

  client.publish({
    destination: '/app/online-status',
    body: JSON.stringify({ isOnline }),
  });
};

// 👥 Request online status of users
export const requestOnlineStatus = (userIds: string[]) => {
  const client = getStompClient();
  if (!client || !client.connected) {
    console.warn('WebSocket is not connected');
    return;
  }

  client.publish({
    destination: '/app/request-online-status',
    body: JSON.stringify({ userIds }),
  });
};

// 👍 Add reaction to message (uses toggle endpoint - backend will add or remove)
export const addReaction = async (
  conversationId: string,
  messageId: string,
  emoji: string
): Promise<void> => {
  await api.post(`/messages/${conversationId}/${messageId}/reactions/${emoji}`);
};

// 👎 Remove reaction from message (uses toggle endpoint)
export const removeReaction = async (
  conversationId: string,
  messageId: string,
  emoji: string
): Promise<void> => {
  await api.post(`/messages/${conversationId}/${messageId}/reactions/${emoji}`);
};

// ✏️ Edit message
export const editMessage = async (
  messageId: string,
  content: string
): Promise<MessageResponseDto> => {
  const res = await api.put<MessageResponseDto>(`/messages/${messageId}`, { content });
  return res.data;
};

// 🗑️ Delete message
export const deleteMessage = async (messageId: string): Promise<void> => {
  await api.delete(`/messages/${messageId}`);
};

// 📎 Add attachment to message
export const addAttachment = async (
  conversationId: string,
  messageId: string,
  attachment: {
    fileName: string;
    url: string;
    fileSize: number;
    mimeType: string;
    attachmentType: string;
  }
): Promise<void> => {
  await api.post(`/messages/${conversationId}/${messageId}/attachments`, attachment);
};

// 📎 Get attachments for a message
export const getAttachments = async (
  conversationId: string,
  messageId: string
): Promise<MessageAttachmentDto[]> => {
  const res = await api.get<ApiResponse<MessageAttachmentDto[]>>(
    `/messages/${conversationId}/${messageId}/attachments`
  );
  return res.data.data;
};

// ✅ Mark message as read
export const markAsRead = async (
  conversationId: string,
  messageId: string
): Promise<void> => {
  await api.post(`/messages/${conversationId}/${messageId}/read`);
};

// 👀 Get read receipts for a message
export const getReadReceipts = async (
  conversationId: string,
  messageId: string
): Promise<{ userId: string; readAt: string }[]> => {
  const res = await api.get<ApiResponse<{ userId: string; readAt: string }[]>>(
    `/messages/${conversationId}/${messageId}/read-receipts`
  );
  return res.data.data;
};
