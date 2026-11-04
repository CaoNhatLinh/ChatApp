// src/store/messenger/createConversationSlice.ts

import type { MessengerSlice, ConversationSlice } from './messenger.store.types';
import type { Conversation, Message } from '@/features/messenger/types/messenger.types';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';
import { isOlderMessageSnapshot } from './message-snapshot';
import { compareMessageIds } from './message-order';
import { conversationTimestamp, reconcileConversationPage } from './conversation-directory';

const conversationComparator = (left: Conversation, right: Conversation): number => {
    if (left.isPinned !== right.isPinned) {
        return left.isPinned ? -1 : 1;
    }

    const leftTime = conversationTimestamp(left.lastActivityAt);
    const rightTime = conversationTimestamp(right.lastActivityAt);
    if (leftTime !== rightTime) {
        return rightTime - leftTime;
    }

    return left.conversationId.localeCompare(right.conversationId);
};

const sortConversations = (conversations: Conversation[]): Conversation[] => (
    [...conversations].sort(conversationComparator)
);

const updateConversationFromMessage = (
    conversation: Conversation,
    message: Message,
    shouldIncreaseUnread: boolean
) => {
    const senderName = message.sender.displayName;
    const nextUnread = shouldIncreaseUnread
        ? (conversation.unreadCount ?? 0) + 1
        : conversation.unreadCount ?? 0;

    return {
        ...conversation,
        lastActivityAt: message.createdAt,
        lastMessage: {
            messageId: message.messageId,
            senderId: message.sender.userId,
            senderName,
            content: message.isDeleted ? MESSENGER_COPY.messageStatus.deleted : message.content,
            revision: message.revision,
            type: message.type,
            createdAt: message.createdAt
        },
        unreadCount: nextUnread
    };
};

export const createConversationSlice: MessengerSlice<ConversationSlice> = (set) => ({
    activeView: 'chat',
    conversations: [],
    conversationsPagination: { hasNext: false, nextCursor: null, loading: false },
    activeConversationId: null,
    conversationEntry: null,
    setConversationEntry: (entry) => set({ conversationEntry: entry }, false, 'setConversationEntry'),
    isInitialized: false,
    friendRequestCount: 0,

    setActiveView: (view) => set({ activeView: view }, false, 'setActiveView'),

    setConversations: (conversations, pagination) => {
        set((state) => ({
            conversations: sortConversations(reconcileConversationPage(state.conversations, conversations, false)),
            conversationsPagination: { ...pagination, loading: false },
            isInitialized: true,
        }), false, 'setConversations');
    },

    appendConversations: (conversations, pagination) => set((state) => ({
        conversations: sortConversations(reconcileConversationPage(state.conversations, conversations, true)),
        conversationsPagination: { ...pagination, loading: false },
    }), false, 'appendConversations'),

    setConversationsLoading: (loading) => set((state) => ({
        conversationsPagination: { ...state.conversationsPagination, loading },
    }), false, 'setConversationsLoading'),

    setActiveConversation: (id) => set(state => ({
        activeConversationId: id,
        activeView: 'chat',
        conversationEntry: null,
        initialMessageHistory: state.activeConversationId === id ? state.initialMessageHistory : null,
        olderMessageHistory: state.activeConversationId === id ? state.olderMessageHistory : null,
    }), false, 'setActiveConversation'),

    hoistConversation: (conversation: Conversation) => set((state) => {
        return {
            conversations: sortConversations(reconcileConversationPage(state.conversations, [conversation], true))
        };
    }, false, 'hoistConversation'),

    setFriendRequestCount: (count) => set({ friendRequestCount: count }, false, 'setFriendRequestCount'),

    updateConversationNotificationPolicy: (conversationId, policy) => set((state) => ({
        conversations: state.conversations.map((conversation) => (
            conversation.conversationId === conversationId
                ? { ...conversation, ...policy }
                : conversation
        )),
    }), false, 'updateConversationNotificationPolicy'),

    updateConversationOwner: (conversationId, ownerId) => set((state) => ({
        conversations: state.conversations.map((conversation) => (
            conversation.conversationId === conversationId
                ? { ...conversation, ownerId }
                : conversation
        )),
    }), false, 'updateConversationOwner'),

    updateConversationChatPolicy: (conversationId, policy) => set((state) => ({
        conversations: state.conversations.map((conversation) => (
            conversation.conversationId === conversationId
                ? { ...conversation, ...policy }
                : conversation
        )),
    }), false, 'updateConversationChatPolicy'),

    pinConversation: (conversationId) => set((state) => {
        const conversations = state.conversations.map(c =>
            c.conversationId === conversationId ? { ...c, isPinned: true } : c
        );
        return { conversations: sortConversations(conversations) };
    }, false, 'pinConversation'),

    unpinConversation: (conversationId) => set((state) => {
        const conversations = state.conversations.map(c =>
            c.conversationId === conversationId ? { ...c, isPinned: false } : c
        );
        return { conversations: sortConversations(conversations) };
    }, false, 'unpinConversation'),

    upsertConversationFromMessage: (message) => set((state) => {
        if (state.unavailableMessageHistory[message.conversationId]) return state;
        const existingConversation = state.conversations.find(c => c.conversationId === message.conversationId);
        if (!existingConversation || !message.sender?.userId) {
            return state;
        }
        const storedMessage = state.messages[message.conversationId]?.find(
            current => current.messageId === message.messageId
        );
        if (isOlderMessageSnapshot(storedMessage, message)) return state;
        const accepted = storedMessage ?? message;
        const preview = existingConversation.lastMessage;
        if (preview?.messageId === accepted.messageId && preview.revision !== undefined
            && accepted.revision !== undefined && accepted.revision < preview.revision) return state;
        const confirmsPending = accepted.clientMessageId
            && preview?.messageId === `temp-${accepted.clientMessageId}`;
        if (preview?.messageId !== accepted.messageId && !confirmsPending
            && (conversationTimestamp(accepted.createdAt) < conversationTimestamp(existingConversation.lastActivityAt)
                || preview && compareMessageIds(accepted.messageId, preview.messageId) === -1)) return state;

        const currentUserId = useAuthStore.getState().user?.userId;
        const isFromOtherUser = message.sender.userId !== currentUserId;
        const shouldIncreaseUnread = isFromOtherUser && !message.isDeleted && (!message.updatedAt || message.updatedAt === message.createdAt)
            && existingConversation.lastMessage?.messageId !== message.messageId
            && conversationTimestamp(message.createdAt) >= conversationTimestamp(existingConversation.lastActivityAt);

        const updatedConversation = updateConversationFromMessage(
            existingConversation,
            accepted,
            shouldIncreaseUnread
        );

        return {
            conversations: sortConversations([
                ...state.conversations.map((conversation) => (
                    conversation.conversationId === message.conversationId ? updatedConversation : conversation
                ))
            ])
        };
    }, false, 'upsertConversationFromMessage'),

    resetUnreadCount: (conversationId) => set((state) => ({
        conversations: state.conversations.map(conversation =>
            conversation.conversationId === conversationId
                ? { ...conversation, unreadCount: 0 }
                : conversation
        )
    }), false, 'resetUnreadCount'),

    setConversationUnreadCount: (conversationId, unreadCount) => set((state) => ({
        conversations: state.conversations.map(conversation =>
            conversation.conversationId === conversationId
                ? { ...conversation, unreadCount: Math.max(0, unreadCount) }
                : conversation
        )
    }), false, 'setConversationUnreadCount'),

    resetState: () => set(() => ({
        activeView: 'chat',
        conversations: [],
        conversationsPagination: { hasNext: false, nextCursor: null, loading: false },
        activeConversationId: null,
        conversationEntry: null,
        friendRequestCount: 0,
        isInitialized: false,
        messages: {},
        messagePinStates: {},
        messagesPagination: {},
        initialMessageHistory: null,
        olderMessageHistory: null,
        unavailableMessageHistory: {},
        typingUsers: {},
        loading: false,
        error: null,
        isSidebarOpen: true,
    }), false, 'resetState'),
});
