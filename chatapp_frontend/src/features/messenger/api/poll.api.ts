import apiClient from '@/shared/api/apiClient';
import type { PollData, CreatePollRequest } from '../types/messenger.types';

interface CanonicalPoll {
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
}

interface CanonicalPollAggregate {
    poll: CanonicalPoll;
    optionCounts: Record<string, number>;
    totalVoters: number;
}

export interface CanonicalPollView extends CanonicalPollAggregate {
    currentUserOptionIndexes: number[];
}

const isCanonicalPollAggregate = (value: unknown): value is CanonicalPollAggregate => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<CanonicalPollAggregate>;
    const poll = candidate.poll as Partial<CanonicalPoll> | undefined;
    const optionCounts = candidate.optionCounts;
    return Boolean(
        poll
        && typeof poll.pollId === 'string'
        && typeof poll.conversationId === 'string'
        && typeof poll.messageId === 'string'
        && typeof poll.question === 'string'
        && poll.question.trim().length > 0
        && poll.question.length <= 500
        && Array.isArray(poll.options)
        && poll.options.length >= 2
        && poll.options.length <= 10
        && poll.options.every(option => typeof option === 'string' && option.trim().length > 0 && option.length <= 200)
        && new Set(poll.options.map(option => option.trim().toLocaleLowerCase())).size === poll.options.length
        && typeof poll.isClosed === 'boolean'
        && typeof poll.isMultipleChoice === 'boolean'
        && typeof poll.isAnonymous === 'boolean'
        && typeof poll.createdBy === 'string'
        && typeof poll.createdAt === 'string'
        && optionCounts
        && typeof optionCounts === 'object'
        && Object.keys(optionCounts).length === poll.options.length
        && poll.options.every((_, index) => Object.hasOwn(optionCounts, String(index)))
        && Object.values(optionCounts).every(count => Number.isSafeInteger(count)
            && count >= 0
            && count <= Number(candidate.totalVoters))
        && Number.isSafeInteger(candidate.totalVoters)
        && Number(candidate.totalVoters) >= 0,
    );
};

const toPollData = (
    aggregate: CanonicalPollAggregate,
    currentUserOptionIndexes?: number[],
): PollData => ({
    ...aggregate.poll,
    expiresAt: aggregate.poll.closesAt ?? undefined,
    totalVotes: aggregate.totalVoters,
    currentUserVotes: currentUserOptionIndexes?.map(index => aggregate.poll.options[index]),
    options: aggregate.poll.options.map((option, index) => {
        const voteCount = aggregate.optionCounts[String(index)];
        return {
            option,
            voteCount,
            percentage: aggregate.totalVoters === 0 ? 0 : (voteCount * 100) / aggregate.totalVoters,
        };
    }),
});

export const mapCanonicalPollView = (value: unknown): PollData => {
    if (!isCanonicalPollAggregate(value)) {
        throw new Error('Canonical poll view is invalid');
    }
    const candidate = value as Partial<CanonicalPollView>;
    if (!Array.isArray(candidate.currentUserOptionIndexes)
        || candidate.currentUserOptionIndexes.some(index => !Number.isSafeInteger(index)
            || index < 0
            || index >= value.poll.options.length)) {
        throw new Error('Canonical poll viewer state is invalid');
    }
    return toPollData(value, candidate.currentUserOptionIndexes);
};

export const mapCanonicalPollAggregate = (value: unknown): PollData => {
    if (!isCanonicalPollAggregate(value)) {
        throw new Error('Canonical poll aggregate is invalid');
    }
    return toPollData(value);
};

const requestPoll = async (request: Promise<{ data: unknown }>): Promise<PollData> => {
    const response = await request;
    return mapCanonicalPollView(response.data);
};

export const createPoll = async (data: CreatePollRequest): Promise<PollData> => requestPoll(
    apiClient.post('/polls', {
        conversationId: data.conversationId,
        clientMessageId: data.clientMessageId,
        question: data.question,
        options: data.options,
        isMultipleChoice: data.isMultipleChoice,
        isAnonymous: data.isAnonymous,
        closesAt: data.expiresAt ?? null,
    }),
);

export const votePoll = async (pollId: string, selectedOptionIndexes: number[]): Promise<PollData> => requestPoll(
    apiClient.post(`/polls/${pollId}/votes`, { selectedOptionIndexes }),
);

export const closePoll = async (pollId: string): Promise<PollData> => requestPoll(
    apiClient.post(`/polls/${pollId}/close`),
);

export const removePollVote = async (pollId: string): Promise<PollData> => requestPoll(
    apiClient.delete(`/polls/${pollId}/votes`),
);
