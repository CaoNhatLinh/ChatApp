// src/store/messenger/createMessageSlice.ts

import { appendHistoryPage, mergeLiveMessage, prependHistoryPage, replaceHistoryWindow } from './message-snapshot';
import { applyPinState } from './message-pin-state';
import type { MessengerSlice, MessageSlice } from './messenger.store.types';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';
import { useAuthStore } from '@/features/auth/model/auth.store';

export const createMessageSlice: MessengerSlice<MessageSlice> = (set) => ({
    messagePinStates: {},
    applyMessagePinState: (snapshot) => set((state) => {
        const previous = state.messagePinStates[snapshot.conversationId];
        if (previous && BigInt(previous.revision) >= BigInt(snapshot.revision)) return state;
        return { messagePinStates: { ...state.messagePinStates, [snapshot.conversationId]: snapshot },
            messages: { ...state.messages, [snapshot.conversationId]: applyPinState(state.messages[snapshot.conversationId] ?? [], snapshot) } };
    }, false, 'applyMessagePinState'),
    messages: {},
    messagesPagination: {},
    initialMessageHistory: null,
    setInitialMessageHistory: (initialMessageHistory) => set({ initialMessageHistory }, false, 'setInitialMessageHistory'),
    olderMessageHistory: null,
    setOlderMessageHistory: (olderMessageHistory) => set({ olderMessageHistory }, false, 'setOlderMessageHistory'),
    unavailableMessageHistory: {},
    setMessageHistoryUnavailable: (conversationId, unavailable) => set((state) => {
        const unavailableMessageHistory = { ...state.unavailableMessageHistory };
        if (!unavailable) {
            if (!unavailableMessageHistory[conversationId]) return state;
            delete unavailableMessageHistory[conversationId];
            return { unavailableMessageHistory };
        }
        unavailableMessageHistory[conversationId] = true;
        const messages = { ...state.messages };
        const messagesPagination = { ...state.messagesPagination };
        delete messages[conversationId];
        delete messagesPagination[conversationId];
        return { unavailableMessageHistory, messages, messagesPagination };
    }, false, 'setMessageHistoryUnavailable'),

    addMessage: (conversationId, message) => set((state) => {
        if (state.unavailableMessageHistory[conversationId]) return state;
        const current = state.messages[conversationId] ?? [];
        const index = current.findIndex(existing => existing.messageId === message.messageId
            || Boolean(message.clientMessageId) && existing.messageId.startsWith('temp-')
                && existing.clientMessageId === message.clientMessageId && existing.sender.userId === message.sender.userId);
        const mergedSnapshot = mergeLiveMessage(index < 0 ? undefined : current[index], message);
        const pinState = state.messagePinStates[conversationId];
        const merged = pinState ? applyPinState([mergedSnapshot], pinState)[0] : mergedSnapshot;
        if (index >= 0 && merged === current[index]) return state;
        const updated = index < 0 ? [...current, merged] : current.map((existing, position) => position === index ? merged : existing);
        return { messages: { ...state.messages, [conversationId]: updated } };
    }, false, 'addMessage'),

    setMessages: (conversationId, messages, context) => set((state) => ({
        messages: { ...state.messages, [conversationId]: applyPinState(replaceHistoryWindow({ current: state.messages[conversationId] ?? [], incoming: messages, before: context.before }), state.messagePinStates[conversationId]) },
        messagesPagination: { ...state.messagesPagination, [conversationId]: { hasNext: context.hasNext, page: context.page, nextCursor: context.nextCursor, fetchedAt: Date.now() } },
    }), false, 'setMessages'),

    appendMessages: (conversationId, messages, context) => set((state) => ({
        messages: { ...state.messages, [conversationId]: applyPinState(appendHistoryPage({ current: state.messages[conversationId] ?? [], incoming: messages, before: context.before }), state.messagePinStates[conversationId]) },
        messagesPagination: { ...state.messagesPagination, [conversationId]: { hasNext: context.hasNext, page: context.page, nextCursor: context.nextCursor, fetchedAt: Date.now() } },
    }), false, 'appendMessages'),

    prependMessages: (conversationId, messages, context) => set((state) => ({
        messages: { ...state.messages, [conversationId]: applyPinState(prependHistoryPage({ current: state.messages[conversationId] ?? [], incoming: messages, before: context.before }), state.messagePinStates[conversationId]) },
        messagesPagination: { ...state.messagesPagination, [conversationId]: { hasNext: context.hasNext, page: context.page, nextCursor: context.nextCursor, fetchedAt: Date.now() } },
    }), false, 'prependMessages'),

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
                        const incomingVotes = pollData.currentUserVotes;
                        const existingVotes = m.poll?.currentUserVotes;

                        return {
                            ...m,
                            poll: {
                                ...pollData,
                                currentUserVotes: incomingVotes ?? existingVotes,
                            }
                        };
                    }
                    return m;
                })
            }
        };
    }, false, 'updatePollData'),

    updateMessageStatus: (conversationId, messageId, status, retry) => set((state) => {
        const msgs = state.messages[conversationId];
        if (!msgs) return state;
        return {
            messages: {
                ...state.messages,
                [conversationId]: msgs.map(m => m.messageId === messageId ? { ...m, ...retry, status } : m)
            }
        };
    }, false, 'updateMessageStatus'),

    updateMessage: (conversationId, message) => set((state) => {
        const msgs = state.messages[conversationId];
        if (!msgs) return state;
        const current = msgs.find(existing => existing.messageId === message.messageId);
        const merged = mergeLiveMessage(current, message);
        if (merged === current) return state;
        return {
            messages: { ...state.messages, [conversationId]: msgs.map(existing => existing.messageId === message.messageId ? merged : existing) },
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
                        revision: merged.revision,
                        senderId: merged.sender.userId,
                        senderName: merged.sender.displayName,
                        content: merged.isDeleted ? MESSENGER_COPY.messageStatus.deleted : merged.content,
                        type: merged.type,
                        createdAt: merged.createdAt,
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
                    const latestReadAt = !message.latestReadAt || readReceipt.readAt > message.latestReadAt
                        ? readReceipt.readAt
                        : message.latestReadAt;
                    return exists
                        ? { ...message, latestReadAt }
                        : { ...message, readReceipts: [...receipts, readReceipt], latestReadAt };
                })
            }
        };
    }, false, 'addReadReceipt'),

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
