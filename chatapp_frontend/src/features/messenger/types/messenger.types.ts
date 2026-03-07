import type { User } from '@/features/auth/types/auth.types';
export type { User };

export type ConversationType = 'dm' | 'group' | 'channel';
export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'NOTIFICATION' | 'POLL';

/* --- Conversation Types --- */

export interface MessageSummary {
    messageId: string;
    senderId: string;
    senderName?: string;
    content: string;
    type: MessageType;
    createdAt: string;
}

export interface Conversation {
    conversationId: string;
    name: string;
    type: ConversationType;
    description?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    backgroundUrl?: string;
    memberCount: number;
    isDeleted: boolean;
    isPinned: boolean;
    lastActivityAt: string;
    otherParticipant?: User; // Only for DM
    lastMessage?: MessageSummary;
}

export interface ConversationMember {
    userId: string;
    conversationId: string;
    role: 'owner' | 'admin' | 'member';
    joinedAt: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
    isOnline?: boolean;
}

/* --- Message Types --- */

export interface Attachment {
    attachmentId: string;
    fileName: string;
    url: string;
    fileSize: number;
    mimeType: string;
}

export interface Reaction {
    emoji: string;
    count: number;
    reactedByCurrentUser: boolean;
    latestUserNames: string[];
}

export interface Message {
    messageId: string;
    conversationId: string;
    sender: User;
    content: string;
    type: MessageType;
    attachments: Attachment[];
    reactions: Reaction[];
    replyTo?: {
        messageId: string;
        content: string;
        senderName: string;
    };
    mentions?: MentionTag[];
    poll?: PollData;
    isForwarded: boolean;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
    status?: 'sending' | 'sent' | 'delivered' | 'failed';
    senderBlockedByViewer?: boolean;
}

/* --- Request Types --- */

export interface SendMessageRequest {
    conversationId: string;
    content: string;
    type: MessageType;
    replyToId?: string;
    mentions?: string[];
}

export interface CreateConversationRequest {
    name?: string;
    type: ConversationType;
    memberIds: string[];
    description?: string;
}

/* --- Mention Types --- */

export type MentionTarget = 'user' | 'all';

export interface MentionTag {
    userId: string;      // UUID of the user, or 'all' for @all
    displayName: string; // Display label shown in the bubble
    type: MentionTarget;
}

/* --- Poll Types --- */

export type PollType = 'single' | 'multiple';

export interface PollOptionData {
    option: string;
    voteCount: number;
    percentage: number;
    voterIds: string[];
    voterNames?: string[];
}

export interface PollData {
    pollId: string;
    conversationId: string;
    messageId: string;
    question: string;
    options: PollOptionData[];
    isClosed: boolean;
    isMultipleChoice: boolean;
    isAnonymous: boolean;
    createdBy: string;
    createdByUsername?: string;
    createdAt: string;
    expiresAt?: string;
    totalVotes: number;
    currentUserVotes?: string[] | null;
    targetUserId?: string | null;
}

export interface CreatePollRequest {
    conversationId: string;
    messageId?: string;
    question: string;
    options: string[];
    isMultipleChoice: boolean;
    isAnonymous: boolean;
    expiresAt?: string; // ISO date string
}

/* --- Realtime Event Types --- */

export interface TypingEvent {
    conversationId: string;
    user: User;
    isTyping: boolean;
}


