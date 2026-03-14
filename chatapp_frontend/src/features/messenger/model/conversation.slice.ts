// src/store/messenger/createConversationSlice.ts

import type { MessengerSlice, ConversationSlice } from './messenger.store.types';
import type { Conversation } from '@/features/messenger/types/messenger.types';

export const createConversationSlice: MessengerSlice<ConversationSlice> = (set) => ({
    activeView: 'chat',
    conversations: [],
    activeConversationId: null,
    friendRequestCount: 0,
    conversationsHasNext: false,
    conversationsPage: 0,
    _loadedConversationIds: new Set(),

    setActiveView: (view) => set({ activeView: view }, false, 'setActiveView'),

    setConversations: (conversations, hasNext = false, page = 0) => {
        const ids = new Set(conversations.map(c => c.conversationId));
        set({ conversations, conversationsHasNext: hasNext, conversationsPage: page, _loadedConversationIds: ids }, false, 'setConversations');
    },

    appendConversations: (newConvs, hasNext, page) => set((state) => {
        const unique = newConvs.filter(c => !state._loadedConversationIds.has(c.conversationId));
        const updatedIds = new Set(state._loadedConversationIds);
        unique.forEach(c => updatedIds.add(c.conversationId));
        return {
            conversations: [...state.conversations, ...unique],
            conversationsHasNext: hasNext,
            conversationsPage: page,
            _loadedConversationIds: updatedIds
        };
    }, false, 'appendConversations'),

    setActiveConversation: (id) => set({ activeConversationId: id, activeView: 'chat' }, false, 'setActiveConversation'),

    hoistConversation: (conversation: Conversation) => set((state) => {
        const without = state.conversations.filter(c => c.conversationId !== conversation.conversationId);
        const pinned = without.filter(c => c.isPinned);
        const unpinned = without.filter(c => !c.isPinned);
        const updatedIds = new Set(state._loadedConversationIds);
        updatedIds.add(conversation.conversationId);

        let updatedConversations: Conversation[];
        if (conversation.isPinned) {
            updatedConversations = [conversation, ...pinned, ...unpinned];
        } else {
            updatedConversations = [...pinned, conversation, ...unpinned];
        }

        return { conversations: updatedConversations, _loadedConversationIds: updatedIds };
    }, false, 'hoistConversation'),

    setFriendRequestCount: (count) => set({ friendRequestCount: count }, false, 'setFriendRequestCount'),

    pinConversation: (conversationId) => set((state) => {
        const conversations = state.conversations.map(c =>
            c.conversationId === conversationId ? { ...c, isPinned: true } : c
        );
        const pinned = conversations.filter(c => c.isPinned);
        const unpinned = conversations.filter(c => !c.isPinned);
        return { conversations: [...pinned, ...unpinned] };
    }, false, 'pinConversation'),

    unpinConversation: (conversationId) => set((state) => {
        const conversations = state.conversations.map(c =>
            c.conversationId === conversationId ? { ...c, isPinned: false } : c
        );
        const pinned = conversations.filter(c => c.isPinned);
        const unpinned = conversations.filter(c => !c.isPinned);
        return { conversations: [...pinned, ...unpinned] };
    }, false, 'unpinConversation'),

    incrementUnreadCount: (conversationId) => set((state) => ({
        conversations: state.conversations.map(conversation =>
            conversation.conversationId === conversationId
                ? { ...conversation, unreadCount: (conversation.unreadCount ?? 0) + 1 }
                : conversation
        )
    }), false, 'incrementUnreadCount'),

    resetUnreadCount: (conversationId) => set((state) => ({
        conversations: state.conversations.map(conversation =>
            conversation.conversationId === conversationId
                ? { ...conversation, unreadCount: 0 }
                : conversation
        )
    }), false, 'resetUnreadCount'),
});
