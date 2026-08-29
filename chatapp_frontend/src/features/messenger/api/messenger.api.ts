import apiClient from '@/shared/api/apiClient';
import { localizeText } from '@/shared/i18n';
import type {
    Conversation,
    ConversationMember,
    Message,
    Attachment,
    MessageRevision,
    CreateConversationRequest,
    SendMessageRequest,
    ConversationNotificationLevel,
    MemberNotificationOverride
} from '../types/messenger.types';

export interface PaginatedResponse<T> {
    content: T[];
    hasNext: boolean;
    number: number;
    size: number;
    nextCursor?: string;
}

export interface MessageSearchFilters {
    conversationId?: string;
    replyToSenderId?: string;
    content?: string;
    senderId?: string;
    type?: string;
    from?: string;
    to?: string;
    mentionedUserId?: string;
    hasAttachment?: boolean;
    isPinned?: boolean;
    page?: number;
    size?: number;
    pageCursor?: string;
}

export interface MessageSearchResult {
    messageId: string;
    conversationId: string;
    messageBucket?: string;
    senderId?: string;
    senderDisplayName?: string;
    senderUsername?: string;
    content: string;
}

interface CanonicalSearchPage {
    content: MessageSearchResult[];
    nextCursor?: string;
    hasNext: boolean;
}

/**
 * DTO interface definitions for payloads from Java backend.
 */
export interface BackendMessage {
    conversationId: string;
    messageBucket: string;
    messageId: string;
    clientMessageId?: string;
    senderId: string;
    content: string;
    messageType: Message['type'];
    contentFormat: string;
    replyToMessageId?: string;
    replyToSenderId?: string;
    stickerId?: string;
    pollId?: string;
    systemEventId?: string;
    forwardedFromConversationId?: string;
    forwardedFromMessageBucket?: string;
    forwardedFromMessageId?: string;
    isDeleted: boolean;
    deletedBy?: string;
    deletedAt?: string;
    editedAt?: string;
    hasAttachments: boolean;
    hasMentions: boolean;
    isPinned: boolean;
    createdAt: string;
}

export interface CanonicalMessageEvent extends BackendMessage {
    eventType: 'MESSAGE_SEND' | 'MESSAGE_EDIT' | 'MESSAGE_DELETE';
}

interface UploadedFileDto {
    assetId?: string;
    attachmentId?: string;
    storageProvider?: string;
    storageKey?: string;
    url: string;
    fileName: string;
    fileSize: number;
    contentType?: string;
    resourceType?: string;
    publicId?: string;
    thumbnailUrl?: string;
    mediumUrl?: string;
    format?: string;
}

interface UploadResponse {
    success: boolean;
    file?: UploadedFileDto;
    uploadedFiles?: UploadedFileDto[];
}

interface CanonicalConversation {
    conversationId: string;
    conversationType: string;
    name: string;
    description?: string;
    createdBy: string;
    ownerId: string;
    createdAt: string;
    updatedAt: string;
    isDeleted: boolean;
    lastActivityAt: string;
    memberCount: number;
    defaultNotificationLevel: ConversationNotificationLevel;
}

const toAttachment = (uploaded: UploadedFileDto): Attachment => {
    if (!uploaded.assetId || !uploaded.attachmentId || !uploaded.storageProvider || !uploaded.storageKey
        || !uploaded.fileName || !uploaded.url || !uploaded.contentType || !uploaded.resourceType) {
        throw new Error('Canonical media response is missing required attachment metadata');
    }
    return {
        assetId: uploaded.assetId,
        attachmentId: uploaded.attachmentId,
        storageProvider: uploaded.storageProvider,
        storageKey: uploaded.storageKey,
        fileName: uploaded.fileName,
        url: uploaded.url,
        fileSize: uploaded.fileSize,
        contentType: uploaded.contentType,
        mimeType: uploaded.contentType,
        resourceType: uploaded.resourceType,
        attachmentType: uploaded.resourceType,
        publicId: uploaded.publicId,
        thumbnailUrl: uploaded.thumbnailUrl,
        mediumUrl: uploaded.thumbnailUrl,
        format: uploaded.format,
    };
};

interface CanonicalConversationListItem {
    conversation: CanonicalConversation;
    pinned: boolean;
    unreadCount: number;
    joinedAt: string;
    notificationOverride: MemberNotificationOverride;
    lastMessage: {
        messageId: string;
        senderId: string;
        senderDisplayName: string;
        contentPreview: string;
        messageType: Message['type'];
        createdAt: string;
        deleted: boolean;
        hasAttachments: boolean;
    };
}

export interface ConversationRole {
    conversationId: string;
    rolePosition: number;
    roleId: string;
    roleCode: string;
    displayName: string;
    colorHex?: string;
    permissions: string[];
    isDefault: boolean;
    isSystem: boolean;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface ConversationChatPolicyRequest {
    chatMode: 'OPEN' | 'READ_ONLY' | 'MANAGERS_ONLY';
    slowModeSeconds: number;
}

export interface ConversationNotificationPolicyRequest {
    defaultNotificationLevel: ConversationNotificationLevel;
}

export interface MemberNotificationPolicyRequest {
    notificationOverride: MemberNotificationOverride;
}

export interface ConversationNotificationPolicyView {
    defaultNotificationLevel: ConversationNotificationLevel;
    notificationOverride: MemberNotificationOverride;
}

export interface MemberChatPolicyRequest {
    mutedUntil?: string | null;
    messageIntervalSeconds?: number | null;
    reason?: string;
}

const mapConversationType = (type: string): Conversation['type'] => {
    const normalized = type.toLowerCase();
    if (normalized === 'dm' || normalized === 'group' || normalized === 'channel') {
        return normalized;
    }
    throw new Error(`Unsupported canonical conversation type: ${type}`);
};

const mapConversationNotificationLevel = (level: string): ConversationNotificationLevel => {
    if (level === 'ALL' || level === 'MENTIONS' || level === 'NONE') {
        return level;
    }
    throw new Error(`Unsupported canonical conversation notification level: ${level}`);
};

const mapMemberNotificationOverride = (override: string): MemberNotificationOverride => {
    if (override === 'INHERIT' || override === 'ALL' || override === 'MENTIONS' || override === 'NONE') {
        return override;
    }
    throw new Error(`Unsupported canonical member notification override: ${override}`);
};

const mapConversation = (conversation: CanonicalConversation): Conversation => ({
    conversationId: conversation.conversationId,
    name: conversation.name,
    type: mapConversationType(conversation.conversationType),
    description: conversation.description,
    createdBy: conversation.createdBy,
    ownerId: conversation.ownerId,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    memberCount: conversation.memberCount,
    isDeleted: conversation.isDeleted,
    isPinned: false,
    lastActivityAt: conversation.lastActivityAt,
    unreadCount: 0,
    defaultNotificationLevel: mapConversationNotificationLevel(conversation.defaultNotificationLevel),
});

const mapConversationListItem = (item: CanonicalConversationListItem): Conversation => ({
    ...mapConversation(item.conversation),
    isPinned: item.pinned,
    unreadCount: item.unreadCount,
    notificationOverride: mapMemberNotificationOverride(item.notificationOverride),
    lastMessage: item.lastMessage ? {
        messageId: item.lastMessage.messageId,
        senderId: item.lastMessage.senderId,
        senderName: item.lastMessage.senderDisplayName,
        content: item.lastMessage.deleted ? localizeText('Tin nhắn đã bị xóa') : item.lastMessage.contentPreview,
        type: item.lastMessage.messageType,
        createdAt: item.lastMessage.createdAt,
    } : undefined,
});

export type UploadResult = SendMessageRequest['attachments'];

interface CanonicalMessagePage {
    content: BackendMessage[];
    nextCursor?: string;
    hasNext: boolean;
}

/**
 * Maps the canonical message contract to the UI model without fabricating
 * profiles, delivery state, attachments, reactions, or reply previews.
 */
export const mapToMessage = (dto: BackendMessage): Message => {
    return {
        messageId: dto.messageId,
        clientMessageId: dto.clientMessageId,
        messageBucket: dto.messageBucket,
        conversationId: dto.conversationId,
        sender: { userId: dto.senderId },
        content: dto.content,
        type: dto.messageType,
        attachments: dto.hasAttachments ? undefined : [],
        reactions: undefined,
        isForwarded: Boolean(dto.forwardedFromConversationId),
        isDeleted: dto.isDeleted,
        createdAt: dto.createdAt,
        updatedAt: dto.editedAt ?? dto.createdAt,
        replyTo: undefined,
        isPinned: dto.isPinned,
    };
};

/* --- Conversation API --- */

export const getConversations = async (limit = 30): Promise<Conversation[]> => {
    const response = await apiClient.get<CanonicalConversationListItem[]>('/conversations', {
        params: { limit: Math.min(100, Math.max(10, limit)) }
    });
    return response.data.map(mapConversationListItem);
};

export const getConversationById = async (id: string): Promise<Conversation> => {
    const response = await apiClient.get<CanonicalConversation>(`/conversations/${id}`);
    return mapConversation(response.data);
};

export const getConversationNotificationPolicy = async (
    conversationId: string,
): Promise<ConversationNotificationPolicyView> => {
    const response = await apiClient.get<ConversationNotificationPolicyView>(
        `/conversations/${conversationId}/notification-policy`,
    );
    if (!['ALL', 'MENTIONS', 'NONE'].includes(response.data.defaultNotificationLevel)
        || !['INHERIT', 'ALL', 'MENTIONS', 'NONE'].includes(response.data.notificationOverride)) {
        throw new Error('Canonical conversation notification policy is invalid');
    }
    return response.data;
};

export const createConversation = async (data: CreateConversationRequest): Promise<Conversation> => {
    const response = await apiClient.post<CanonicalConversation>('/conversations', {
        conversationType: data.type.toUpperCase(),
        name: data.name,
        description: data.description,
        firstMember: data.type === 'dm' ? data.memberIds[0] : undefined,
        memberIds: data.memberIds,
    });
    return mapConversation(response.data);
};

/* --- Message API --- */

export const getMessages = async (
    conversationId: string,
    params: { page?: number; size?: number; before?: string } = { page: 0, size: 50 }
): Promise<PaginatedResponse<Message>> => {
    const response = await apiClient.get<CanonicalMessagePage>(`/conversations/${conversationId}/messages`, {
        params: { limit: params.size ?? 50, cursor: params.before }
    });
    const data = response.data;

    return {
        content: data.content.map(mapToMessage),
        hasNext: data.hasNext,
        number: params.page ?? 0,
        size: data.content.length,
        nextCursor: data.nextCursor,
    };
};

export const sendMessageHttp = async (data: SendMessageRequest): Promise<Message> => {
    const attachments = data.attachments?.map((attachment) => {
        if (!attachment.attachmentId || !attachment.storageProvider || !attachment.storageKey || !attachment.fileName) {
            throw new Error('Canonical message attachments require attachmentId, storageProvider, storageKey, and fileName');
        }
        return {
            attachmentId: attachment.attachmentId,
            assetId: attachment.assetId,
            storageProvider: attachment.storageProvider,
            storageKey: attachment.storageKey,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType ?? attachment.contentType,
            byteSize: attachment.fileSize,
            thumbnailUrl: attachment.thumbnailUrl,
            isSpoiler: false
        };
    });
    const response = await apiClient.post<BackendMessage>(`/conversations/${data.conversationId}/messages`, {
        clientMessageId: data.clientMessageId,
        messageType: data.type,
        content: data.content,
        contentFormat: 'PLAIN',
        replyToMessageId: data.replyToId,
        mentionedUserIds: data.mentions,
        attachments
    });
    return mapToMessage(response.data);
};

export const editMessage = async (
    conversationId: string,
    messageBucket: string,
    messageId: string,
    content: string
): Promise<Message> => {
    const response = await apiClient.put<BackendMessage>(
        `/conversations/${conversationId}/messages/${messageId}`,
        { content },
        { params: { bucket: messageBucket } }
    );
    return mapToMessage(response.data);
};

export const deleteMessage = async (
    conversationId: string,
    messageBucket: string,
    messageId: string
): Promise<Message> => {
    const response = await apiClient.delete<BackendMessage>(
        `/conversations/${conversationId}/messages/${messageId}`,
        { params: { bucket: messageBucket } }
    );
    return mapToMessage(response.data);
};

export const reactToMessage = async (
    conversationId: string,
    messageBucket: string,
    messageId: string,
    emoji: string,
): Promise<void> => {
    await apiClient.post(
        `/conversations/${conversationId}/messages/${messageId}/reactions`,
        { emoji },
        { params: { bucket: messageBucket } },
    );
};

export const removeMessageReaction = async (
    conversationId: string,
    messageBucket: string,
    messageId: string,
    emoji: string,
): Promise<void> => {
    await apiClient.delete(
        `/conversations/${conversationId}/messages/${messageId}/reactions`,
        { params: { bucket: messageBucket, emoji } },
    );
};

export const markMessageAsRead = async (
    conversationId: string,
    messageBucket: string,
    messageId: string,
): Promise<void> => {
    await apiClient.post(
        `/conversations/${conversationId}/messages/${messageId}/read`,
        undefined,
        { params: { bucket: messageBucket } },
    );
};

export const getMessageRevisions = async (
    conversationId: string,
    messageBucket: string,
    messageId: string,
): Promise<MessageRevision[]> => {
    const response = await apiClient.get<MessageRevision[]>(
        `/conversations/${conversationId}/messages/${messageId}/revisions`,
        { params: { bucket: messageBucket } },
    );
    return response.data;
};

export const togglePinMessage = async (conversationId: string, messageBucket: string, messageId: string): Promise<void> => {
    await apiClient.post(
        `/conversations/${conversationId}/messages/${messageId}/pin`,
        undefined,
        { params: { bucket: messageBucket } }
    );
};

export const unpinMessage = async (conversationId: string, messageBucket: string, messageId: string): Promise<void> => {
    await apiClient.delete(
        `/conversations/${conversationId}/messages/${messageId}/pin`,
        { params: { bucket: messageBucket } },
    );
};

export const markMessagesAsRead = async (
    conversationId: string,
    messages: Array<Pick<Message, 'messageId' | 'messageBucket' | 'createdAt'>>,
): Promise<void> => {
    if (!conversationId || messages.length === 0) {
        return;
    }
    const uniqueMessages = [...new Map(
        messages
            .filter((message): message is Pick<Message, 'messageId' | 'createdAt'> & { messageBucket: string } => Boolean(message.messageBucket))
            .map((message) => [message.messageId, message]),
    ).values()];
    const latestMessage = uniqueMessages.reduce<typeof uniqueMessages[number] | undefined>((latest, message) => (
        !latest || new Date(message.createdAt).getTime() > new Date(latest.createdAt).getTime() ? message : latest
    ), undefined);
    if (latestMessage) {
        await markMessageAsRead(conversationId, latestMessage.messageBucket, latestMessage.messageId);
    }
};

export const getConversationUnreadCount = async (conversationId: string): Promise<number> => {
    if (!conversationId) {
        return 0;
    }
    const conversations = await getConversations(200);
    const matched = conversations.find((conversation) => conversation.conversationId === conversationId);
    return matched?.unreadCount ?? 0;
};

export const searchMessages = async (
    filters: MessageSearchFilters,
    options?: { signal?: AbortSignal }
): Promise<PaginatedResponse<MessageSearchResult>> => {
    const request = {
        limit: filters.size ?? 20,
        pageCursor: filters.pageCursor,
        conversationId: filters.conversationId,
        q: filters.content,
        senderId: filters.senderId,
        messageType: filters.type,
        fromAt: filters.from,
        toAt: filters.to,
        mentionUserId: filters.mentionedUserId,
        replyToSenderId: filters.replyToSenderId,
        hasAttachment: filters.hasAttachment,
        isPinned: filters.isPinned,
    };

    const response = await apiClient.post<CanonicalSearchPage>('/search/messages', request, { signal: options?.signal });
    return {
        content: response.data.content,
        hasNext: response.data.hasNext,
        number: 0,
        size: response.data.content.length,
        nextCursor: response.data.nextCursor,
    };
};

export const uploadFiles = async (files: File[]): Promise<SendMessageRequest['attachments']> => {
    if (files.length === 0) {
        throw new Error('At least one file is required');
    }

    if (files.length === 1) {
        const formData = new FormData();
        formData.append('file', files[0]);
        const response = await apiClient.post<UploadResponse>('/files/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        const uploaded = response.data.file;
        if (!response.data.success || !uploaded) {
            throw new Error('Canonical media upload did not return a file');
        }
        return [toAttachment(uploaded)];
    }

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    const response = await apiClient.post<UploadResponse>('/files/upload/multiple', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (!response.data.success || !response.data.uploadedFiles || response.data.uploadedFiles.length !== files.length) {
        throw new Error('Canonical media upload did not return all files');
    }
    return response.data.uploadedFiles.map(toAttachment);
};

export const pinConversation = async (conversationId: string): Promise<void> => {
    await apiClient.post(`/conversations/${conversationId}/pin`);
};

export const unpinConversation = async (conversationId: string): Promise<void> => {
    await apiClient.delete(`/conversations/${conversationId}/pin`);
};

// --- Additional Conversation helpers ---

export const getConversationMembers = async (conversationId: string): Promise<ConversationMember[]> => {
    const response = await apiClient.get<ConversationMember[]>(`/conversations/${conversationId}/members`);
    return response.data;
};

export const findDmConversation = async (_currentUserId: string, otherUserId: string): Promise<Conversation> => {
    const response = await apiClient.get<CanonicalConversation>(`/conversations/dm/${otherUserId}`);
    return mapConversation(response.data);
};

export const addConversationMember = async (
    conversationId: string,
    userId: string,
    roleIds: string[] = [],
    reason?: string,
): Promise<void> => {
    await apiClient.post(`/conversations/${conversationId}/members`, { userId, roleIds, reason });
};

export const removeConversationMember = async (conversationId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/conversations/${conversationId}/members/${userId}`);
};

export const leaveConversation = async (conversationId: string): Promise<void> => {
    await apiClient.post(`/conversations/${conversationId}/leave`);
};

export const listConversationRoles = async (conversationId: string): Promise<ConversationRole[]> => {
    const response = await apiClient.get<ConversationRole[]>(`/conversations/${conversationId}/roles`);
    return response.data;
};

export const assignConversationRoles = async (
    conversationId: string,
    userId: string,
    roleIds: string[],
): Promise<void> => {
    await apiClient.post(`/conversations/${conversationId}/members/${userId}/roles`, { roleIds });
};

export const updateConversationChatPolicy = async (
    conversationId: string,
    request: ConversationChatPolicyRequest,
): Promise<void> => {
    await apiClient.put(`/conversations/${conversationId}/chat-policy`, request);
};

export const updateConversationNotificationPolicy = async (
    conversationId: string,
    request: ConversationNotificationPolicyRequest,
): Promise<void> => {
    await apiClient.put(`/conversations/${conversationId}/notification-policy`, request);
};

export const updateMemberNotificationPolicy = async (
    conversationId: string,
    userId: string,
    request: MemberNotificationPolicyRequest,
): Promise<void> => {
    await apiClient.put(`/conversations/${conversationId}/members/${userId}/notification-policy`, request);
};

export const updateMemberChatPolicy = async (
    conversationId: string,
    userId: string,
    request: MemberChatPolicyRequest,
): Promise<void> => {
    await apiClient.put(`/conversations/${conversationId}/members/${userId}/chat-policy`, request);
};



