// src/store/messenger/createConversationSlice.ts

import type { MessengerSlice, ConversationSlice } from './messenger.store.types';
import type { Conversation, Message } from '@/features/messenger/types/messenger.types';
import { useAuthStore } from '@/features/auth/model/auth.store';

const toTimestamp = (value?: string): number => {
    const parsed = Date.parse(value ?? '');
    return Number.isNaN(parsed) ? 0 : parsed;
};

const conversationComparator = (left: Conversation, right: Conversation): number => {
    if (left.isPinned !== right.isPinned) {
        return left.isPinned ? -1 : 1;
    }

    const leftTime = toTimestamp(left.lastActivityAt);
    const rightTime = toTimestamp(right.lastActivityAt);
    if (leftTime !== rightTime) {
        return rightTime - leftTime;
    }

    return left.conversationId.localeCompare(right.conversationId);
};

const sortConversations = (conversations: Conversation[]): Conversation[] => (
    [...conversations].sort(conversationComparator)
);

const mergeConversations = (stateConversations: Conversation[], incomingConversations: Conversation[]): Conversation[] => {
    const byId = new Map<string, Conversation>();
    stateConversations.forEach((conversation) => {
        byId.set(conversation.conversationId, conversation);
    });
    incomingConversations.forEach((conversation) => {
        byId.set(conversation.conversationId, conversation);
    });
    return sortConversations(Array.from(byId.values()));
};

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
            content: message.content,
            type: message.type,
            createdAt: message.createdAt
        },
        unreadCount: nextUnread
    };
};

export const createConversationSlice: MessengerSlice<ConversationSlice> = (set) => ({
    activeView: 'chat',
    conversations: [],
    activeConversationId: null,
    isInitialized: false,
    friendRequestCount: 0,
    conversationsHasNext: false,
    conversationsPage: 0,
    _loadedConversationIds: new Set(),

    setActiveView: (view) => set({ activeView: view }, false, 'setActiveView'),

    setConversations: (conversations, hasNext = false, page = 0) => {
        const merged = mergeConversations([], conversations);
        const ids = new Set(merged.map((c) => c.conversationId));
        set({
            conversations: merged,
            conversationsHasNext: hasNext,
            conversationsPage: page,
            _loadedConversationIds: ids,
            isInitialized: true,
        }, false, 'setConversations');
    },

    appendConversations: (newConvs, hasNext, page) => set((state) => {
        const merged = mergeConversations(state.conversations, newConvs);
        const updatedIds = new Set(state._loadedConversationIds);
        newConvs.forEach(c => updatedIds.add(c.conversationId));
        return {
            conversations: merged,
            conversationsHasNext: hasNext,
            conversationsPage: page,
            _loadedConversationIds: updatedIds
        };
    }, false, 'appendConversations'),

    setActiveConversation: (id) => set({ activeConversationId: id, activeView: 'chat' }, false, 'setActiveConversation'),

    hoistConversation: (conversation: Conversation) => set((state) => {
        const updatedIds = new Set(state._loadedConversationIds);
        updatedIds.add(conversation.conversationId);

        return {
            conversations: sortConversations([
                ...state.conversations.filter((item) => item.conversationId !== conversation.conversationId),
                conversation
            ]),
            _loadedConversationIds: updatedIds
        };
    }, false, 'hoistConversation'),

    setFriendRequestCount: (count) => set({ friendRequestCount: count }, false, 'setFriendRequestCount'),

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
        const existingConversation = state.conversations.find(c => c.conversationId === message.conversationId);
        if (!existingConversation || !message.sender?.userId) {
            return state;
        }

        const currentUserId = useAuthStore.getState().user?.userId;
        const isFromOtherUser = message.sender.userId !== currentUserId;
        const shouldIncreaseUnread = isFromOtherUser && state.activeConversationId !== message.conversationId;

        const updatedConversation = updateConversationFromMessage(
            existingConversation,
            message,
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
        activeConversationId: null,
        friendRequestCount: 0,
        conversationsHasNext: false,
        conversationsPage: 0,
        _loadedConversationIds: new Set(),
        isInitialized: false,
        messages: {},
        messagesPagination: {},
        typingUsers: {},
        loading: false,
        error: null,
        isSidebarOpen: true,
    }), false, 'resetState'),
});
