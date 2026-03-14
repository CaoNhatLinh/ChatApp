// src/store/messenger/createMessageSlice.ts

import type { MessengerSlice, MessageSlice } from './messenger.store.types';
import type { Message, Conversation } from '@/features/messenger/types/messenger.types';
import { useAuthStore } from '@/features/auth/model/auth.store';

export const createMessageSlice: MessengerSlice<MessageSlice> = (set) => ({
    messages: {},
    messagesPagination: {},

    addMessage: (conversationId, message) => set((state) => {
        const currentMessages = state.messages[conversationId] || [];
        const activeConversationId = state.activeConversationId;
        const currentUserId = useAuthStore.getState().user?.userId;
        const existingIndex = currentMessages.findIndex(m => m.messageId === message.messageId);

        let updatedMessages: Message[];
        let isServerMessage = false;

        if (message.messageId && typeof message.messageId === 'string' && message.sender) {
            isServerMessage = !message.messageId.startsWith('temp-');
        } else {
            isServerMessage = true;
        }

        if (isServerMessage && message.sender) {
            if (existingIndex !== -1) {
                updatedMessages = [...currentMessages];
                updatedMessages[existingIndex] = { ...updatedMessages[existingIndex], ...message };
            } else {
                const tempIdx = currentMessages.findIndex(
                    m => m.messageId && typeof m.messageId === 'string' && m.messageId.startsWith('temp-')
                        && m.sender?.userId === message.sender?.userId
                        && m.content === message.content
                );
                if (tempIdx !== -1) {
                updatedMessages = [...currentMessages];
                updatedMessages[tempIdx] = message;
                } else {
                    updatedMessages = [...currentMessages, message];
                }
            }
        } else {
            if (existingIndex !== -1) {
                updatedMessages = [...currentMessages];
                updatedMessages[existingIndex] = { ...updatedMessages[existingIndex], ...message };
            } else {
                updatedMessages = [...currentMessages, message];
            }
        }

        let targetConversation: Conversation | undefined;
        const otherConversations = state.conversations.filter(c => {
            if (c.conversationId === conversationId) {
                targetConversation = {
                    ...c,
                    lastActivityAt: message.createdAt,
                    lastMessage: {
                        messageId: message.messageId,
                        senderId: message.sender?.userId || '',
                        senderName: message.sender?.displayName || '',
                        content: message.content,
                        type: message.type || 'TEXT',
                        createdAt: message.createdAt
                    }
                };
                return false;
            }
            return true;
        });

        let updatedConversations: Conversation[];

        if (targetConversation) {
            const pinned = otherConversations.filter(c => c.isPinned);
            const unpinned = otherConversations.filter(c => !c.isPinned);

            if (targetConversation.isPinned) {
                updatedConversations = [targetConversation, ...pinned, ...unpinned];
            } else {
                updatedConversations = [...pinned, targetConversation, ...unpinned];
            }
        } else {
            updatedConversations = state.conversations;
        }

        return {
            messages: { ...state.messages, [conversationId]: updatedMessages },
            conversations: updatedConversations.map(conversation => {
                if (
                    conversation.conversationId === conversationId &&
                    existingIndex === -1 &&
                    message.sender?.userId &&
                    message.sender.userId !== currentUserId &&
                    activeConversationId !== conversationId
                ) {
                    return { ...conversation, unreadCount: (conversation.unreadCount ?? 0) + 1 };
                }
                return conversation;
            })
        };
    }, false, 'addMessage'),

    setMessages: (conversationId, messages, hasNext = false, page = 0) => set((state) => ({
        messages: { ...state.messages, [conversationId]: messages },
        messagesPagination: {
            ...state.messagesPagination,
            [conversationId]: { hasNext, page }
        }
    }), false, 'setMessages'),

    appendMessages: (conversationId, newMessages, hasNext, page) => set((state) => {
        const currentMessages = state.messages[conversationId] || [];
        const uniqueNewMessages = newMessages.filter(nm => !currentMessages.some(cm => cm.messageId === nm.messageId));
        return {
            messages: { ...state.messages, [conversationId]: [...currentMessages, ...uniqueNewMessages] },
            messagesPagination: {
                ...state.messagesPagination,
                [conversationId]: { hasNext, page }
            }
        };
    }, false, 'appendMessages'),

    prependMessages: (conversationId, newMessages, hasNext, page) => set((state) => {
        const currentMessages = state.messages[conversationId] || [];
        const uniqueNewMessages = newMessages.filter(nm => !currentMessages.some(cm => cm.messageId === nm.messageId));
        return {
            messages: { ...state.messages, [conversationId]: [...uniqueNewMessages, ...currentMessages] },
            messagesPagination: {
                ...state.messagesPagination,
                [conversationId]: { hasNext, page }
            }
        };
    }, false, 'prependMessages'),

    updateMessageReactions: (conversationId, messageId, reactionEvent) => set((state) => {
        const currentUserId = useAuthStore.getState().user?.userId;
        const msgs = state.messages[conversationId];
        if (!msgs) return state;

        return {
            messages: {
                ...state.messages,
                [conversationId]: msgs.map(m => {
                    if (m.messageId !== messageId) return m;

                    const { emoji, action, userId } = reactionEvent;
                    const isMe = userId === currentUserId;
                    const currentReactions = [...(m.reactions || [])];

                    const existingIdx = currentReactions.findIndex(r => r.emoji === emoji);

                    if (action === 'ADD') {
                        if (existingIdx >= 0) {
                            currentReactions[existingIdx] = {
                                ...currentReactions[existingIdx],
                                count: currentReactions[existingIdx].count + 1,
                                reactedByCurrentUser: isMe ? true : currentReactions[existingIdx].reactedByCurrentUser
                            };
                        } else {
                            currentReactions.push({
                                emoji,
                                count: 1,
                                reactedByCurrentUser: isMe,
                                latestUserNames: []
                            });
                        }
                    } else if (action === 'REMOVE') {
                        if (existingIdx >= 0) {
                            const newCount = Math.max(0, currentReactions[existingIdx].count - 1);
                            if (newCount === 0) {
                                currentReactions.splice(existingIdx, 1);
                            } else {
                                currentReactions[existingIdx] = {
                                    ...currentReactions[existingIdx],
                                    count: newCount,
                                    reactedByCurrentUser: isMe ? false : currentReactions[existingIdx].reactedByCurrentUser
                                };
                            }
                        }
                    }

                    return { ...m, reactions: currentReactions };
                })
            }
        };
    }, false, 'updateMessageReactions'),

    updatePollData: (conversationId, pollData) => set((state) => {
        const msgs = state.messages[conversationId];
        if (!msgs || !pollData) return state;

        const messageId = pollData.messageId;
        if (!messageId) return state;

        return {
            messages: {
                ...state.messages,
                [conversationId]: msgs.map(m => {
                    if (m.messageId === messageId) {
                        const currentUserId = useAuthStore.getState().user?.userId;
                        const incomingTargetId = pollData.targetUserId;
                        const incomingVotes = pollData.currentUserVotes;
                        const existingVotes = m.poll?.currentUserVotes;
                        const existingTargetId = m.poll?.targetUserId;

                        let finalUserVotes = existingVotes;

                        if (!incomingTargetId) {
                            finalUserVotes = existingVotes;
                        } else if (incomingTargetId === currentUserId) {
                            finalUserVotes = incomingVotes;
                        } else {
                            console.warn(`[PollLeakProtection] Blocked leaked data for ${incomingTargetId}`);
                            finalUserVotes = existingVotes;
                        }

                        return {
                            ...m,
                            poll: {
                                ...pollData,
                                currentUserVotes: finalUserVotes,
                                targetUserId: incomingTargetId ?? existingTargetId ?? null
                            }
                        };
                    }
                    return m;
                })
            }
        };
    }, false, 'updatePollData'),

    updateMessageStatus: (conversationId, messageId, status) => set((state) => {
        const msgs = state.messages[conversationId];
        if (!msgs) return state;
        return {
            messages: {
                ...state.messages,
                [conversationId]: msgs.map(m => m.messageId === messageId ? { ...m, status } : m)
            }
        };
    }, false, 'updateMessageStatus'),

    updateMessage: (conversationId, message) => set((state) => {
        const msgs = state.messages[conversationId];
        if (!msgs) return state;
        return {
            messages: {
                ...state.messages,
                [conversationId]: msgs.map(existing => existing.messageId === message.messageId ? { ...existing, ...message } : existing)
            },
            conversations: state.conversations.map(conversation => {
                if (conversation.conversationId !== conversationId) {
                    return conversation;
                }
                const isLastMessage = conversation.lastMessage?.messageId === message.messageId;
                if (!isLastMessage) {
                    return conversation;
                }
                return {
                    ...conversation,
                    lastMessage: {
                        messageId: message.messageId,
                        senderId: message.sender.userId,
                        senderName: message.sender.displayName,
                        content: message.isDeleted ? 'Tin nhắn đã bị xóa' : message.content,
                        type: message.type,
                        createdAt: message.createdAt,
                    }
                };
            })
        };
    }, false, 'updateMessage'),

    addReadReceipt: (conversationId, messageId, readReceipt) => set((state) => {
        const msgs = state.messages[conversationId];
        if (!msgs) return state;
        return {
            messages: {
                ...state.messages,
                [conversationId]: msgs.map(message => {
                    if (message.messageId !== messageId) {
                        return message;
                    }
                    const receipts = message.readReceipts ?? [];
                    const exists = receipts.some(receipt => receipt.readerId === readReceipt.readerId);
                    return exists
                        ? message
                        : { ...message, readReceipts: [...receipts, readReceipt] };
                })
            }
        };
    }, false, 'addReadReceipt'),

    updateMessagePinStatus: (conversationId, messageId, isPinned) => set((state) => {
        const msgs = state.messages[conversationId];
        if (!msgs) return state;
        return {
            messages: {
                ...state.messages,
                [conversationId]: msgs.map(m => m.messageId === messageId ? { ...m, isPinned } : m)
            }
        };
    }, false, 'updateMessagePinStatus'),

    addMessageAttachment: (conversationId, messageId, attachment) => set((state) => {
        const msgs = state.messages[conversationId];
        if (!msgs) return state;
        return {
            messages: {
                ...state.messages,
                [conversationId]: msgs.map(message => {
                    if (message.messageId !== messageId) return message;
                    const attachments = message.attachments ?? [];
                    const exists = attachments.some(a => a.url === attachment.url);
                    return exists ? message : { ...message, attachments: [...attachments, attachment] };
                })
            }
        };
    }, false, 'addMessageAttachment'),

    removeMessage: (conversationId, messageId) => set((state) => {
        const msgs = state.messages[conversationId];
        if (!msgs) return state;
        return {
            messages: {
                ...state.messages,
                [conversationId]: msgs.filter(m => m.messageId !== messageId)
            }
        };
    }, false, 'removeMessage'),
});
