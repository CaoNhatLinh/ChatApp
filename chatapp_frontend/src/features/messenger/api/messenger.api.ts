import apiClient from '@/common/lib/api-client';
import type {
    Conversation,
    Message,
    CreateConversationRequest,
    SendMessageRequest,
    User
} from '../types/messenger.types';

export interface PaginatedResponse<T> {
    content: T[];
    hasNext: boolean;
    number: number;
    size: number;
}

/**
 * Các interface DTO phản ánh chính xác cấu trúc dữ liệu từ Java Backend.
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
}

interface PaginatedDto<T> {
    content: T[];
    hasNext?: boolean;
    last?: boolean;
    number: number;
    size: number;
}

/**
 * Chuyển đổi dữ liệu từ Backend sang định dạng Message của Frontend một cách an toàn.
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
        // Map Mentions (UUIDs) sang cấu trúc Tag của Frontend
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
        } : undefined
    };
};

/* --- Conversation API --- */

export const getConversations = async (page = 0, size = 30): Promise<PaginatedResponse<Conversation>> => {
    const response = await apiClient.get<PaginatedDto<Conversation> | Conversation[]>('/conversations/my', {
        params: { page, size }
    });

    if (Array.isArray(response.data)) {
        return {
            content: response.data,
            hasNext: false,
            number: 0,
            size: response.data.length
        };
    }

    const data = response.data;
    return {
        content: data.content ?? [],
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

export const deleteMessage = async (messageId: string): Promise<void> => {
    await apiClient.delete(`/messages/${messageId}`);
};

export const reactToMessage = async (messageId: string, emoji: string): Promise<void> => {
    await apiClient.post(`/messages/${messageId}/react`, { emoji });
};

export const pinConversation = async (conversationId: string): Promise<void> => {
    await apiClient.put(`/conversations/${conversationId}/pin`);
};

export const unpinConversation = async (conversationId: string): Promise<void> => {
    await apiClient.put(`/conversations/${conversationId}/unpin`);
};
