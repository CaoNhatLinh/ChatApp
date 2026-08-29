import type { User } from '@/features/auth/types/auth.types';
export type { User };

export type ConversationType = 'dm' | 'group' | 'channel';
export type ConversationNotificationLevel = 'ALL' | 'MENTIONS' | 'NONE';
export type MemberNotificationOverride = 'INHERIT' | 'ALL' | 'MENTIONS' | 'NONE';
export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO' | 'VIDEO' | 'STICKER' | 'POLL' | 'SYSTEM';

/* --- Conversation Types --- */

export interface MessageSummary {
    messageId: string;
    senderId: string;
    senderName?: string;
    content: string;
    type: MessageType;
    createdAt: string;
}

export interface MessageReadReceipt {
    readerId: string;
    readAt: string;
}

export interface MessageRevision {
    revisionNumber: number;
    content: string;
    editedAt: string;
    editedBy: string;
    action: 'EDIT' | 'DELETE';
}

export interface Conversation {
    conversationId: string;
    name: string;
    type: ConversationType;
    description?: string;
    createdBy: string;
    ownerId: string;
    createdAt: string;
    updatedAt: string;
    backgroundUrl?: string;
    memberCount: number;
    isDeleted: boolean;
    isPinned: boolean;
    lastActivityAt: string;
    unreadCount: number;
    defaultNotificationLevel: ConversationNotificationLevel;
    notificationOverride?: MemberNotificationOverride;
    otherParticipant?: User; // Only for DM
    lastMessage?: MessageSummary;
}

export interface ConversationMember {
    userId: string;
    conversationId: string;
    role: 'owner' | 'admin' | 'member';
    joinedAt: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
}

/* --- Message Types --- */

export interface Attachment {
    attachmentId?: string;
    assetId?: string;
    storageProvider?: string;
    storageKey?: string;
    fileName: string;
    url: string;
    fileSize: number;
    mimeType?: string;
    contentType?: string;
    attachmentType?: string;
    resourceType?: string;
    publicId?: string;
    thumbnailUrl?: string;
    mediumUrl?: string;
    format?: string;
}

export interface Reaction {
    emoji: string;
    count: number;
    reactedByCurrentUser: boolean;
    latestUserNames: string[];
}

export interface MessageSender {
    userId: string;
    userName?: string;
    displayName?: string;
    avatarUrl?: string;
}

export interface Message {
    messageId: string;
    clientMessageId?: string;
    messageBucket?: string;
    conversationId: string;
    sender: MessageSender;
    content: string;
    type: MessageType;
    attachments?: Attachment[];
    reactions?: Reaction[];
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
    readReceipts?: MessageReadReceipt[];
    status?: 'sending' | 'sent' | 'delivered' | 'failed';
    senderBlockedByViewer?: boolean;
    isPinned?: boolean;
}

/* --- Request Types --- */

export interface SendMessageRequest {
    clientMessageId: string;
    conversationId: string;
    content: string;
    type: MessageType;
    replyToId?: string;
    mentions?: string[];
    attachments?: Attachment[];
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
    user: {
        userId: string;
        username: string;
        displayName: string;
        avatarUrl?: string;
    };
    isTyping: boolean;
}

export interface CallCommand {
    conversationId: string;
    callId: string;
    callType?: 'VOICE' | 'VIDEO';
    mediaRegion?: string;
    maxParticipants?: number;
    targetUserId: string;
    signal?: Record<string, unknown>;
}

export interface CallEvent {
    conversationId: string;
    callId: string;
    actorId: string;
    action: 'START' | 'JOIN' | 'LEAVE' | 'SIGNAL' | 'END';
    callType?: 'VOICE' | 'VIDEO';
    mediaRegion?: string;
    maxParticipants?: number;
    targetUserId: string;
    signal?: Record<string, unknown>;
    occurredAt: string;
}


