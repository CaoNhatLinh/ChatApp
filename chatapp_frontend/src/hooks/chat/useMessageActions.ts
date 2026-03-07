// src/hooks/chat/useMessageActions.ts
// Extracted from MessageList.tsx - message action handlers (react, edit, delete)

import { useCallback } from 'react';
import type { MessageResponseDto } from '@/types/message';

interface UseMessageActionsOptions {
    conversationId: string;
    allMessages: MessageResponseDto[];
    fetchMessages: () => Promise<void>;
    onReply?: (message: MessageResponseDto) => void;
}

interface UseMessageActionsReturn {
    handleReply: (message: MessageResponseDto) => void;
    handleReact: (messageId: string, emoji: string) => Promise<void>;
    handleEdit: (messageId: string) => void;
    handleDelete: (messageId: string) => Promise<void>;
}

export function useMessageActions({
    conversationId,
    allMessages,
    fetchMessages,
    onReply,
}: UseMessageActionsOptions): UseMessageActionsReturn {

    const handleReply = useCallback((message: MessageResponseDto) => {
        onReply?.(message);
    }, [onReply]);

    const handleReact = useCallback(async (messageId: string, emoji: string) => {
        try {
            // Dynamic import to avoid circular deps
            const { addReaction, removeReaction } = await import('@/api/messageApi');

            const message = allMessages.find((m) => m.messageId === messageId);
            const userReaction = message?.reactions.find(
                (r) => r.emoji === emoji && r.reactedByCurrentUser
            );

            if (userReaction) {
                await removeReaction(conversationId, messageId, emoji);
            } else {
                await addReaction(conversationId, messageId, emoji);
            }
            await fetchMessages();
        } catch (error) {
            console.error('Failed to handle reaction:', error instanceof Error ? error.message : error);
        }
    }, [conversationId, allMessages, fetchMessages]);

    const handleEdit = useCallback((_messageId: string) => {
        // TODO: implement edit UI
    }, []);

    const handleDelete = useCallback(async (messageId: string) => {
        try {
            const { deleteMessage } = await import('@/api/messageApi');
            await deleteMessage(messageId);
            await fetchMessages();
        } catch (error) {
            console.error('Failed to delete message:', error instanceof Error ? error.message : error);
        }
    }, [fetchMessages]);

    return { handleReply, handleReact, handleEdit, handleDelete };
}
