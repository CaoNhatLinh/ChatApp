import api from "@/lib/axios";
import axios from 'axios';
import type { Conversation, ConversationRequest, ConversationResponseDto, CreateConversationRequest, ConversationMember } from "@/types/conversation";
import type { ApiResponse } from '@/types/api';

export const fetchMyConversations = async (): Promise<Conversation[]> => {
  try {
    const response = await api.get<Conversation[]>("/conversations/my");

    // Backend now returns ConversationResponseDto with proper structure
    // No need for additional processing
    return response.data;
  } catch (error) {
    console.error("API error:", error instanceof Error ? error.message : error);
    throw error;
  }
};
export const createConversation = async (ConversationRequest: ConversationRequest): Promise<Conversation> => {

  const response = await api.post<Conversation>("/conversations/create", ConversationRequest);
  return response.data;
};
export const findDmConversation = async (userId1: string, userId2: string): Promise<Conversation> => {
  const response = await api.get<Conversation>(`/conversations/dm?userId1=${userId1}&userId2=${userId2}`);
  return response.data;
};

// 📋 Fetch user's conversations (new API)
export const fetchMyConversationsNew = async (
  token: string,
  userId: string
): Promise<ConversationResponseDto[]> => {
  try {
    const response = await axios.get<ApiResponse<ConversationResponseDto[]>>(
      `/api/conversations/my?userId=${userId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data.data;
  } catch (error) {
    console.error("API error:", error instanceof Error ? error.message : error);
    throw error;
  }
};

// 🆕 Create new conversation
export const createConversationNew = async (
  token: string,
  request: CreateConversationRequest
): Promise<ConversationResponseDto> => {
  const response = await axios.post<ConversationResponseDto>(
    "/api/conversations/create",
    request,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
};

// 💬 Find DM conversation between two users
export const findDmConversationNew = async (
  token: string,
  userId1: string,
  userId2: string
): Promise<ConversationResponseDto> => {
  const response = await axios.get<ConversationResponseDto>(
    `/api/conversations/dm?userId1=${userId1}&userId2=${userId2}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

// 👥 Conversation Members Management
export const addMember = async (member: ConversationMember): Promise<void> => {
  await api.post("/conversations/my/members", member);
};

export const removeMember = async (conversationId: string, memberId: string): Promise<void> => {
  await api.delete(`/conversations/${conversationId}/members/${memberId}`);
};

export const getConversationMembers = async (conversationId: string): Promise<ConversationMember[]> => {
  const response = await api.get<ConversationMember[]>(`/conversations/${conversationId}/members`);
  return response.data;
};