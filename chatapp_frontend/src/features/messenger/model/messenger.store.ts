// src/store/messengerStore.ts
// Refactored: Split into slices (Conversation, Message, Typing, UI)

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Message, TypingEvent } from '@/features/messenger/types/messenger.types';
import type { MessengerState } from './messenger.store.types';

// Import Slices
import { createConversationSlice } from './conversation.slice';
import { createMessageSlice } from './message.slice';
import { createTypingSlice } from './typing.slice';
import { createUISlice } from './ui.slice';

export type { MessengerState } from './messenger.store.types';

export const useMessengerStore = create<MessengerState>()(
    devtools(
        (...a) => ({
            ...createConversationSlice(...a),
            ...createMessageSlice(...a),
            ...createTypingSlice(...a),
            ...createUISlice(...a),
        }),
        { name: 'MessengerStore' }
    )
);

export const EMPTY_MESSAGES: Message[] = [];
export const EMPTY_TYPING: TypingEvent[] = [];

// Advanced Selectors for Performance
export const selectActiveView = (state: MessengerState) => state.activeView;
export const selectConversations = (state: MessengerState) => state.conversations;
export const selectActiveConversationId = (state: MessengerState) => state.activeConversationId;

export const selectMessages = (conversationId: string) => (state: MessengerState) =>
    state.messages[conversationId] || EMPTY_MESSAGES;

export const selectTypingForActive = (state: MessengerState) => {
    const activeId = state.activeConversationId;
    return activeId ? (state.typingUsers[activeId] || EMPTY_TYPING) : EMPTY_TYPING;
};

export const selectMessengerLoading = (state: MessengerState) => state.loading;
export const selectMessengerError = (state: MessengerState) => state.error;
export const selectIsSidebarOpen = (state: MessengerState) => state.isSidebarOpen;
