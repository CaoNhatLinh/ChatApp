// src/features/messenger/hooks/useMessageActions.ts
// Message action handlers: react, edit, delete

import { useCallback } from 'react';
import type { Message } from '@/features/messenger/types/messenger.types';

interface UseMessageActionsOptions {
    conversationId: string;
    allMessages: Message[];
    fetchMessages: () => Promise<void>;
    onReply?: (message: Message) => void;
}

interface UseMessageActionsReturn {
    handleReply: (message: Message) => void;
    handleReact: (messageId: string, emoji: string) => Promise<void>;
    handleEdit: (messageId: string) => void;
    handleDelete: (messageId: string) => Promise<void>;
}

export function useMessageActions({
    conversationId: _conversationId,
    allMessages: _allMessages,
    fetchMessages,
    onReply,
}: UseMessageActionsOptions): UseMessageActionsReturn {

    const handleReply = useCallback((message: Message) => {
        onReply?.(message);
    }, [onReply]);

    const handleReact = useCallback(async (messageId: string, emoji: string) => {
        try {
            const { reactToMessage } = await import('@/features/messenger/api/messenger.api');
            await reactToMessage(messageId, emoji);
            await fetchMessages();
        } catch (error) {
            console.error('Failed to handle reaction:', error instanceof Error ? error.message : error);
        }
    }, [fetchMessages]);

    const handleEdit = useCallback((_messageId: string) => {
        // TODO: implement edit UI
    }, []);

    const handleDelete = useCallback(async (messageId: string) => {
        try {
            const { deleteMessage } = await import('@/features/messenger/api/messenger.api');
            await deleteMessage(_conversationId, messageId);
            await fetchMessages();
        } catch (error) {
            console.error('Failed to delete message:', error instanceof Error ? error.message : error);
        }
    }, [_conversationId, fetchMessages]);

    return { handleReply, handleReact, handleEdit, handleDelete };
}
