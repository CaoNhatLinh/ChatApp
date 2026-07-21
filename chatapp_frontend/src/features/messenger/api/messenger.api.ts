import apiClient from '@/shared/api/apiClient';
import type {
    Conversation,
    ConversationMember,
    Message,
    MessageReadReceipt,
    MessageRevision,
    CreateConversationRequest,
    SendMessageRequest,
    User
} from '../types/messenger.types';

interface ApiResponse<T> {
    status: number;
    message: string;
    data: T;
}

export interface PaginatedResponse<T> {
    content: T[];
    hasNext: boolean;
    number: number;
    size: number;
}

export interface MessageSearchFilters {
    conversationId?: string;
    recipientUserId?: string;
    content?: string;
    senderId?: string;
    type?: string;
    from?: string;
    to?: string;
    mentionedUserId?: string;
    replyToMessageId?: string;
    page?: number;
    size?: number;
}

export interface MessageSearchResult {
    messageId: string;
    conversationId: string;
    senderDisplayName?: string;
    senderUsername?: string;
    content: string;
}

/**
 * DTO interface definitions for payloads from Java backend.
 */
export interface BackendMessage {
    messageId: string;
    conversationId: string;
    sender: User;
    content: string;
    messageType?: Message['type'];
    type?: Message['type'];
    attachments?: Message['attachments'];
    reactions?: Message['reactions'];
    poll?: Message['poll'];
    replyTo?: {
        messageId: string;
        content: string;
        sender: User;
    };
    mentionedUsers?: string[];
    forwarded?: boolean;
    isForwarded?: boolean; // Fallback
    deleted?: boolean;
    isDeleted?: boolean;  // Fallback
    createdAt: string;
    updatedAt: string;
    status?: Message['status'];
    senderBlockedByViewer?: boolean;
    readReceipts?: MessageReadReceipt[];
    isPinned?: boolean;
}

interface UploadedFileDto {
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

const isApiResponse = <T>(payload: T | ApiResponse<T>): payload is ApiResponse<T> => {
    return payload !== null && typeof payload === 'object' && 'data' in payload;
};

const unwrapData = <T>(payload: T | ApiResponse<T>): T => {
    if (isApiResponse(payload)) {
        return payload.data;
    }
    return payload;
};

type ConversationPayload = PaginatedDto<Conversation> | Conversation[];

const normalizeConversation = (conversation: Conversation): Conversation => ({
    ...conversation,
    unreadCount: typeof (conversation as Conversation & { unreadCount?: number }).unreadCount === 'number'
        ? (conversation as Conversation & { unreadCount?: number }).unreadCount ?? 0
        : 0
});

const getPaginationData = <T>(payload: unknown): PaginatedResponse<T> => {
    if (!payload || typeof payload !== 'object') {
        return { content: [], hasNext: false, number: 0, size: 0 };
    }

    const source = payload as {
        content?: unknown;
        hasNext?: unknown;
        number?: unknown;
        page?: unknown;
        size?: unknown;
        totalElements?: unknown;
        totalPages?: unknown;
        last?: unknown;
    };

    const contentSource = Array.isArray(source.content) ? source.content : [];
    const content = contentSource.filter((item): item is T => item !== null && item !== undefined);
    const hasNextRaw = source.hasNext;
    const number = typeof source.number === 'number' ? source.number : 0;
    const size = typeof source.size === 'number' ? source.size : content.length;
    const pageValue = typeof source.page === 'number' ? source.page : number;
    const totalPages = typeof source.totalPages === 'number' ? source.totalPages : undefined;
    const totalElements = typeof source.totalElements === 'number' ? source.totalElements : undefined;
    const hasNextExplicit = typeof hasNextRaw === 'boolean' ? hasNextRaw : undefined;
    const last = typeof source.last === 'boolean' ? source.last : undefined;

    const hasNext =
        typeof hasNextExplicit === 'boolean'
            ? hasNextExplicit
            : typeof last === 'boolean'
                ? !last
                : typeof totalPages === 'number'
                    ? pageValue < totalPages - 1
                    : typeof totalElements === 'number' && size > 0
                        ? (pageValue + 1) * size < totalElements
                        : false;

    return {
        content,
        hasNext,
        number: number,
        size
    };
};

export type UploadResult = SendMessageRequest['attachments'];

interface PaginatedDto<T> {
    content: T[];
    hasNext?: boolean;
    last?: boolean;
    number: number;
    size: number;
}

/**
 * Chuy?n d?i d? li?u t? Backend sang d?nh d?ng Message c?a Frontend m?t cách an toàn.
 */
export const mapToMessage = (dto: Partial<BackendMessage>): Message => {
    const createdAt = dto.createdAt ?? new Date().toISOString();

    return {
        messageId: dto.messageId ?? '',
        conversationId: dto.conversationId ?? '',
        sender: dto.sender ?? { userId: '', userName: '', displayName: 'Unknown' },
        content: dto.content ?? '',
        type: dto.messageType || dto.type || 'TEXT',
        attachments: dto.attachments ?? [],
        reactions: dto.reactions ?? [],
        poll: dto.poll,
        isForwarded: !!(dto.forwarded ?? dto.isForwarded),
        isDeleted: !!(dto.deleted ?? dto.isDeleted),
        createdAt,
        updatedAt: dto.updatedAt ?? createdAt,
        status: dto.status ?? 'sent',
        senderBlockedByViewer: dto.senderBlockedByViewer ?? false,
        readReceipts: dto.readReceipts ?? [],
        // Map Mentions (UUIDs) sang c?u trúc Tag c?a Frontend
        mentions: dto.mentionedUsers?.map(uid => ({
            userId: uid,
            displayName: uid,
            type: 'user'
        })),
        // Map ReplyTo
        replyTo: dto.replyTo ? {
            messageId: dto.replyTo.messageId,
            content: dto.replyTo.content,
            senderName: dto.replyTo.sender?.displayName || 'Unknown'
        } : undefined,
        isPinned: dto.isPinned ?? false
    };
};

/* --- Conversation API --- */

export const getConversations = async (page = 0, size = 30): Promise<PaginatedResponse<Conversation>> => {
    const response = await apiClient.get<ConversationPayload | ApiResponse<ConversationPayload>>('/conversations/my', {
        params: { page, size }
    });

    const payload = unwrapData<ConversationPayload>(response.data);

    if (Array.isArray(payload)) {
        return {
            content: payload.map((conversation: Conversation) => normalizeConversation(conversation)),
            hasNext: false,
            number: 0,
            size: payload.length
        };
    }

    const data = payload;
    return {
        content: (data.content ?? []).map((conversation: Conversation) => normalizeConversation(conversation)),
        hasNext: data.hasNext !== undefined ? data.hasNext : !data.last,
        number: data.number ?? page,
        size: data.size ?? size
    };
};

export const getConversationById = async (id: string): Promise<Conversation> => {
    const response = await apiClient.get<Conversation>(`/conversations/${id}`);
    return response.data;
};

export const createConversation = async (data: CreateConversationRequest): Promise<Conversation> => {
    const response = await apiClient.post<Conversation>('/conversations/create', data);
    return response.data;
};

/* --- Message API --- */

export const getMessages = async (
    conversationId: string,
    params: { page?: number; size?: number; before?: string } = { page: 0, size: 50 }
): Promise<PaginatedResponse<Message>> => {
    const response = await apiClient.get<PaginatedDto<BackendMessage>>(`/messages/${conversationId}`, { params });
    const data = response.data;

    return {
        content: (data.content ?? []).map(mapToMessage),
        hasNext: data.hasNext !== undefined ? data.hasNext : !data.last,
        number: data.number ?? (params.page ?? 0),
        size: data.size ?? (params.size ?? 50)
    };
};

export const sendMessageHttp = async (data: SendMessageRequest): Promise<Message> => {
    const response = await apiClient.post<BackendMessage>('/messages', data);
    return mapToMessage(response.data);
};

export const editMessage = async (conversationId: string, messageId: string, content: string): Promise<Message> => {
    const response = await apiClient.put<BackendMessage>(`/messages/${conversationId}/${messageId}`, { content });
    return mapToMessage(response.data);
};

export const deleteMessage = async (conversationId: string, messageId: string): Promise<Message> => {
    const response = await apiClient.delete<BackendMessage>(`/messages/${conversationId}/${messageId}`);
    return mapToMessage(response.data);
};

export const reactToMessage = async (messageId: string, emoji: string): Promise<void> => {
    await apiClient.post(`/messages/${messageId}/react`, { emoji });
};

export const markMessageAsRead = async (conversationId: string, messageId: string): Promise<void> => {
    await apiClient.post(`/messages/${conversationId}/${messageId}/read`);
};

export const getMessageRevisions = async (conversationId: string, messageId: string): Promise<MessageRevision[]> => {
    const response = await apiClient.get<MessageRevision[]>(`/messages/${conversationId}/${messageId}/revisions`);
    return response.data;
};

export const togglePinMessage = async (conversationId: string, messageId: string): Promise<void> => {
    await apiClient.post(`/messages/${conversationId}/${messageId}/pin`);
};

export const markMessagesAsRead = async (conversationId: string, messageIds: string[]): Promise<void> => {
    if (!conversationId || messageIds.length === 0) {
        return;
    }
    const uniqueMessageIds = [...new Set(messageIds)];
    const promises = uniqueMessageIds.map((messageId) => markMessageAsRead(conversationId, messageId));
    await Promise.allSettled(promises);
};

export const getConversationUnreadCount = async (conversationId: string): Promise<number> => {
    if (!conversationId) {
        return 0;
    }
    const response = await getConversations(0, 200);
    const matched = response.content.find((conversation) => conversation.conversationId === conversationId);
    return matched?.unreadCount ?? 0;
};

export const searchMessages = async (
    filters: MessageSearchFilters,
    options?: { signal?: AbortSignal }
): Promise<PaginatedResponse<MessageSearchResult>> => {
    const request = {
        page: filters.page ?? 0,
        size: filters.size ?? 20,
        conversationId: filters.conversationId,
        recipientUserId: filters.recipientUserId,
        content: filters.content,
        senderId: filters.senderId,
        type: filters.type,
        from: filters.from,
        to: filters.to,
        mentionedUserId: filters.mentionedUserId,
        replyToMessageId: filters.replyToMessageId
    };

    const response = await apiClient.get('/search/messages', {
        params: request,
        signal: options?.signal
    });
    const responseData = unwrapData(response.data);
    return getPaginationData<MessageSearchResult>(responseData);
};

export const uploadFiles = async (files: File[]): Promise<SendMessageRequest['attachments']> => {
    if (files.length === 0) {
        return [];
    }

    if (files.length === 1) {
        const formData = new FormData();
        formData.append('file', files[0]);
        const response = await apiClient.post<UploadResponse>('/files/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        const uploaded = response.data.file;
        return uploaded ? [{
            fileName: uploaded.fileName,
            url: uploaded.url,
            fileSize: uploaded.fileSize,
            contentType: uploaded.contentType,
            mimeType: uploaded.contentType,
            resourceType: uploaded.resourceType,
            attachmentType: uploaded.resourceType,
            publicId: uploaded.publicId,
            thumbnailUrl: uploaded.thumbnailUrl,
            mediumUrl: uploaded.mediumUrl,
            format: uploaded.format,
        }] : [];
    }

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    const response = await apiClient.post<UploadResponse>('/files/upload/multiple', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return (response.data.uploadedFiles ?? []).map(uploaded => ({
        fileName: uploaded.fileName,
        url: uploaded.url,
        fileSize: uploaded.fileSize,
        contentType: uploaded.contentType,
        mimeType: uploaded.contentType,
        resourceType: uploaded.resourceType,
        attachmentType: uploaded.resourceType,
        publicId: uploaded.publicId,
        thumbnailUrl: uploaded.thumbnailUrl,
        mediumUrl: uploaded.mediumUrl,
        format: uploaded.format,
    }));
};

export const pinConversation = async (conversationId: string): Promise<void> => {
    await apiClient.put(`/conversations/${conversationId}/pin`);
};

export const unpinConversation = async (conversationId: string): Promise<void> => {
    await apiClient.put(`/conversations/${conversationId}/unpin`);
};

// --- Additional Conversation helpers ---

export const getConversationMembers = async (conversationId: string): Promise<ConversationMember[]> => {
    const response = await apiClient.get<ConversationMember[]>(`/conversations/${conversationId}/members`);
    return response.data;
};

export const findDmConversation = async (userId1: string, userId2: string): Promise<Conversation> => {
    const response = await apiClient.get<Conversation>(`/conversations/dm?userId1=${userId1}&userId2=${userId2}`);
    return response.data;
};



