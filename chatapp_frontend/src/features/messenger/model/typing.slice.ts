// src/store/messenger/createTypingSlice.ts

import type { MessengerSlice, TypingSlice } from './messenger.store.types';
import type { TypingEvent } from '@/features/messenger/types/messenger.types';

export const createTypingSlice: MessengerSlice<TypingSlice> = (set) => ({
    typingUsers: {},

    setTyping: (event: TypingEvent) => set((state) => {
        const { conversationId, user, isTyping } = event;
        const userId = user.userId;
        const currentTyping = state.typingUsers[conversationId] || [];

        let updatedTyping;
        if (isTyping) {
            if (currentTyping.some(u => u.user.userId === userId)) return state;
            updatedTyping = [...currentTyping, event];
        } else {
            updatedTyping = currentTyping.filter(u => u.user.userId !== userId);
        }

        return {
            typingUsers: { ...state.typingUsers, [conversationId]: updatedTyping }
        };
    }, false, 'setTyping'),

    clearTyping: (conversationId: string) => set((state) => {
        const newTypingUsers = { ...state.typingUsers };
        delete newTypingUsers[conversationId];
        return { typingUsers: newTypingUsers };
    }, false, 'clearTyping'),
});
