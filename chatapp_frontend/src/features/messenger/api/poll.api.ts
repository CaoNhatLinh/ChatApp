import apiClient from '@/shared/api/apiClient';
import type { PollData, CreatePollRequest } from '../types/messenger.types';

/* --- Poll API --- */
// NOTE: apiClient.baseURL already includes '/api', so paths here are relative to '/api'

interface CanonicalPollView {
    poll: {
        pollId: string;
        conversationId: string;
        messageId: string;
        question: string;
        options: string[];
        isClosed: boolean;
        isMultipleChoice: boolean;
        isAnonymous: boolean;
        createdBy: string;
        createdAt: string;
        closesAt?: string | null;
    };
    optionCounts: Record<string, number>;
    currentUserOptionIndexes: number[];
    totalVoters: number;
    voterIdsByOption: Record<string, string[]>;
}

const toPollData = (view: CanonicalPollView): PollData => {
    const totalVoters = view.totalVoters ?? 0;
    return {
        ...view.poll,
        expiresAt: view.poll.closesAt ?? undefined,
        totalVotes: totalVoters,
        currentUserVotes: (view.currentUserOptionIndexes ?? [])
            .map(index => view.poll.options[index])
            .filter((option): option is string => option !== undefined),
        options: view.poll.options.map((option, index) => {
            const voteCount = Number(view.optionCounts?.[String(index)] ?? 0);
            return {
                option,
                voteCount,
                percentage: totalVoters === 0 ? 0 : (voteCount * 100) / totalVoters,
                voterIds: view.voterIdsByOption?.[String(index)] ?? [],
            };
        }),
    };
};

export const createPoll = async (data: CreatePollRequest): Promise<PollData> => {
    const response = await apiClient.post<CanonicalPollView>('/polls', {
        conversationId: data.conversationId,
        clientMessageId: crypto.randomUUID(),
        question: data.question,
        options: data.options,
        isMultipleChoice: data.isMultipleChoice,
        isAnonymous: data.isAnonymous,
        closesAt: data.expiresAt ?? null,
    });
    return toPollData(response.data);
};

export const votePoll = async (pollId: string, selectedOptionIndexes: number[]): Promise<PollData> => {
    const response = await apiClient.post<CanonicalPollView>(`/polls/${pollId}/votes`, {
        selectedOptionIndexes,
    });
    return toPollData(response.data);
};

export const getPollResults = async (pollId: string): Promise<PollData> => {
    const response = await apiClient.get<CanonicalPollView>(`/polls/${pollId}`);
    return toPollData(response.data);
};

export const closePoll = async (pollId: string): Promise<PollData> => {
    const response = await apiClient.post<CanonicalPollView>(`/polls/${pollId}/close`);
    return toPollData(response.data);
};

export const removePollVote = async (pollId: string): Promise<PollData> => {
    const response = await apiClient.delete<CanonicalPollView>(`/polls/${pollId}/votes`);
    return toPollData(response.data);
};
