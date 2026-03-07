// src/api/searchApi.ts

import api from '@/lib/axios';
import type { Conversation } from '@/types/conversation';
import type { MessageResponseDto } from '@/types/message';

export interface SearchConversationParams {
  query?: string;
  type?: 'PRIVATE' | 'GROUP';
  limit?: number;
}

export interface SearchMessageParams {
  conversationId?: string;
  content?: string;
  senderId?: string;
  messageType?: 'TEXT' | 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO';
  limit?: number;
}

/**
 * 🔍 Search conversations using Elasticsearch
 * Backend: GET /api/search/conversations
 */
export const searchConversations = async (params: SearchConversationParams): Promise<Conversation[]> => {
  const queryParams = new URLSearchParams();
  if (params.query) queryParams.append('query', params.query);
  if (params.type) queryParams.append('type', params.type);
  if (params.limit) queryParams.append('limit', params.limit.toString());

  const response = await api.get<Conversation[]>(`/search/conversations?${queryParams.toString()}`);
  return response.data;
};

/**
 * 🔍 Search messages using Elasticsearch
 * Backend: GET /api/search/messages
 */
export const searchMessages = async (params: SearchMessageParams): Promise<MessageResponseDto[]> => {
  const queryParams = new URLSearchParams();
  if (params.conversationId) queryParams.append('conversationId', params.conversationId);
  if (params.content) queryParams.append('content', params.content);
  if (params.senderId) queryParams.append('senderId', params.senderId);
  if (params.messageType) queryParams.append('messageType', params.messageType);
  if (params.limit) queryParams.append('limit', params.limit.toString());

  const response = await api.get<MessageResponseDto[]>(`/search/messages?${queryParams.toString()}`);
  return response.data;
};

/**
 * 🔍 Search messages with mentions
 * Backend: GET /api/search/messages/mentions
 */
export const searchMessagesByMention = async (
  userId: string,
  conversationId?: string,
  limit: number = 50
): Promise<MessageResponseDto[]> => {
  const queryParams = new URLSearchParams();
  queryParams.append('userId', userId);
  if (conversationId) queryParams.append('conversationId', conversationId);
  queryParams.append('limit', limit.toString());

  const response = await api.get<MessageResponseDto[]>(`/search/messages/mentions?${queryParams.toString()}`);
  return response.data;
};
