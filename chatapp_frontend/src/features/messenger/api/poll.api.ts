import apiClient from '@/shared/api/apiClient';
import type { PollData, CreatePollRequest } from '../types/messenger.types';
import type { ConversationMember } from '../types/messenger.types';

/* --- Poll API --- */
// NOTE: apiClient.baseURL already includes '/api', so paths here are relative to '/api'

export const createPoll = async (data: CreatePollRequest): Promise<PollData> => {
    const params = new URLSearchParams();
    params.append('conversationId', data.conversationId);
    if (data.messageId) params.append('messageId', data.messageId);
    params.append('question', data.question);
    data.options.forEach(opt => params.append('options', opt));
    params.append('isMultipleChoice', String(data.isMultipleChoice));
    if (data.expiresAt) params.append('expiresAt', data.expiresAt);

    const response = await apiClient.post<PollData>('/polls', null, { params });
    return response.data;
};

export const votePoll = async (pollId: string, selectedOptions: string[]): Promise<PollData> => {
    const params = new URLSearchParams();
    selectedOptions.forEach(opt => params.append('selectedOptions', opt));
    const response = await apiClient.post<PollData>(`/polls/${pollId}/vote`, null, { params });
    return response.data;
};

export const getPollResults = async (pollId: string): Promise<PollData> => {
    const response = await apiClient.get<PollData>(`/polls/${pollId}/results`);
    return response.data;
};

export const closePoll = async (pollId: string): Promise<void> => {
    await apiClient.post(`/polls/${pollId}/close`);
};

export const removePollVote = async (pollId: string): Promise<PollData> => {
    const response = await apiClient.delete<PollData>(`/polls/${pollId}/vote`);
    return response.data;
};

/* --- Members API (for Mention autocomplete) --- */

export const getConversationMembers = async (conversationId: string): Promise<ConversationMember[]> => {
    const response = await apiClient.get<ConversationMember[]>(`/conversations/${conversationId}/members`);
    return response.data;
};
