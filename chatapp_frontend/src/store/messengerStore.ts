import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useAuthStore } from './authStore';
import type {
    Conversation,
    Message,
    TypingEvent
} from '@/features/messenger/types/messenger.types';

export interface MessengerState {
    activeView: 'chat' | 'contacts';
    conversations: Conversation[];
    activeConversationId: string | null;
    messages: Record<string, Message[]>; // conversationId -> messages
    typingUsers: Record<string, TypingEvent[]>; // conversationId -> typing units
    loading: boolean;
    error: string | null;
    isSidebarOpen: boolean;
    friendRequestCount: number;

    // Pagination state
    conversationsHasNext: boolean;
    conversationsPage: number;
    messagesPagination: Record<string, { hasNext: boolean, page: number }>;

    // Track IDs that are already in list (for dedup during loadMore)
    _loadedConversationIds: Set<string>;

    // Actions
    setActiveView: (view: 'chat' | 'contacts') => void;
    setConversations: (conversations: Conversation[], hasNext?: boolean, page?: number) => void;
    appendConversations: (conversations: Conversation[], hasNext: boolean, page: number) => void;
    setActiveConversation: (id: string | null) => void;
    addMessage: (conversationId: string, message: Message) => void;
    hoistConversation: (conversation: Conversation) => void;
    setMessages: (conversationId: string, messages: Message[], hasNext?: boolean, page?: number) => void;
    appendMessages: (conversationId: string, messages: Message[], hasNext: boolean, page: number) => void;
    prependMessages: (conversationId: string, messages: Message[], hasNext: boolean, page: number) => void;
    setTyping: (event: TypingEvent) => void;
    setError: (error: string | null) => void;
    setLoading: (loading: boolean) => void;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;
    setFriendRequestCount: (count: number) => void;
    pinConversation: (id: string) => void;
    unpinConversation: (id: string) => void;
    clearTyping: (conversationId: string) => void;
    updateMessageReactions: (conversationId: string, messageId: string, reactionEvent: { emoji: string; userId: string; action: 'ADD' | 'REMOVE' }) => void;
    updatePollData: (conversationId: string, pollData: Message['poll']) => void;
    updateMessageStatus: (conversationId: string, messageId: string, status: Message['status']) => void;
    removeMessage: (conversationId: string, messageId: string) => void;
}

export const useMessengerStore = create<MessengerState>()(
    devtools(
        (set) => ({
            activeView: 'chat',
            conversations: [],
            activeConversationId: null,
            messages: {},
            typingUsers: {},
            loading: false,
            error: null,
            isSidebarOpen: true,
            friendRequestCount: 0,

            // Pagination initial state
            conversationsHasNext: false,
            conversationsPage: 0,
            messagesPagination: {},

            // Dedup tracking
            _loadedConversationIds: new Set(),

            setActiveView: (view) => set({ activeView: view }, false, 'setActiveView'),

            setConversations: (conversations, hasNext = false, page = 0) => {
                const ids = new Set(conversations.map(c => c.conversationId));
                set({ conversations, conversationsHasNext: hasNext, conversationsPage: page, _loadedConversationIds: ids }, false, 'setConversations');
            },

            appendConversations: (newConvs, hasNext, page) => set((state) => {
                // Deduplicate: skip conversations already loaded (e.g. hoisted from a later page)
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

            addMessage: (conversationId, message) => set((state) => {
                const currentMessages = state.messages[conversationId] || [];

                // Exact messageId dedup
                if (currentMessages.some(m => m.messageId === message.messageId)) {
                    return state;
                }

                // If this is a real server message (not temp-*), replace any matching
                // optimistic temp message from the same sender with same content
                let updatedMessages: Message[];
                const isServerMessage = !message.messageId.startsWith('temp-');
                if (isServerMessage) {
                    const tempIdx = currentMessages.findIndex(
                        m => m.messageId.startsWith('temp-')
                            && m.sender?.userId === message.sender?.userId
                            && m.content === message.content
                    );
                    if (tempIdx !== -1) {
                        // Replace the temp message in-place with the real one
                        updatedMessages = [...currentMessages];
                        updatedMessages[tempIdx] = message;
                    } else {
                        updatedMessages = [...currentMessages, message];
                    }
                } else {
                    updatedMessages = [...currentMessages, message];
                }

                // Realtime hoisting logic
                let targetConversation: Conversation | undefined;
                const otherConversations = state.conversations.filter(c => {
                    if (c.conversationId === conversationId) {
                        targetConversation = {
                            ...c,
                            lastActivityAt: message.createdAt,
                            lastMessage: {
                                messageId: message.messageId,
                                senderId: message.sender.userId,
                                senderName: message.sender.displayName,
                                content: message.content,
                                type: message.type,
                                createdAt: message.createdAt
                            }
                        };
                        return false;
                    }
                    return true;
                });

                let updatedConversations: Conversation[];

                if (targetConversation) {
                    // Re-sort: Pinned stay at top, then the hoisted one, then others
                    const pinned = otherConversations.filter(c => c.isPinned);
                    const unpinned = otherConversations.filter(c => !c.isPinned);

                    if (targetConversation.isPinned) {
                        // If hoisted is pinned, it goes to the top of pinned list
                        updatedConversations = [targetConversation, ...pinned, ...unpinned];
                    } else {
                        // If hoisted is NOT pinned, it goes to the top of unpinned list
                        updatedConversations = [...pinned, targetConversation, ...unpinned];
                    }
                } else {
                    // Conversation not in current list (e.g. on a later page or brand new).
                    // We store the message; hoistConversation will be called externally
                    // once we fetch the conversation details from the API.
                    updatedConversations = state.conversations;
                }

                return {
                    messages: { ...state.messages, [conversationId]: updatedMessages },
                    conversations: updatedConversations
                };
            }, false, 'addMessage'),

            hoistConversation: (conversation) => set((state) => {
                // If already in the list, remove it first to re-insert at correct position
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
                // Re-sort
                const pinned = conversations.filter(c => c.isPinned);
                const unpinned = conversations.filter(c => !c.isPinned);
                return { conversations: [...pinned, ...unpinned] };
            }, false, 'pinConversation'),

            unpinConversation: (conversationId) => set((state) => {
                const conversations = state.conversations.map(c =>
                    c.conversationId === conversationId ? { ...c, isPinned: false } : c
                );
                // Re-sort
                const pinned = conversations.filter(c => c.isPinned);
                const unpinned = conversations.filter(c => !c.isPinned);
                return { conversations: [...pinned, ...unpinned] };
            }, false, 'unpinConversation'),

            setMessages: (conversationId, messages, hasNext = false, page = 0) => set((state) => ({
                messages: { ...state.messages, [conversationId]: messages },
                messagesPagination: {
                    ...state.messagesPagination,
                    [conversationId]: { hasNext, page }
                }
            }), false, 'setMessages'),

            appendMessages: (conversationId, newMessages, hasNext, page) => set((state) => {
                const currentMessages = state.messages[conversationId] || [];
                // Filter out duplicates
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
                // Filter out duplicates
                const uniqueNewMessages = newMessages.filter(nm => !currentMessages.some(cm => cm.messageId === nm.messageId));
                return {
                    messages: { ...state.messages, [conversationId]: [...uniqueNewMessages, ...currentMessages] },
                    messagesPagination: {
                        ...state.messagesPagination,
                        [conversationId]: { hasNext, page }
                    }
                };
            }, false, 'prependMessages'),

            setTyping: (event) => set((state) => {
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

            clearTyping: (conversationId) => set((state) => {
                const newTypingUsers = { ...state.typingUsers };
                delete newTypingUsers[conversationId];
                return { typingUsers: newTypingUsers };
            }, false, 'clearTyping'),

            setError: (error) => set({ error }, false, 'setError'),

            setLoading: (loading) => set({ loading }, false, 'setLoading'),

            setSidebarOpen: (open) => set({ isSidebarOpen: open }, false, 'setSidebarOpen'),

            toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen }), false, 'toggleSidebar'),

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
                                        latestUserNames: [] // Lightweight frontend UI update
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

                                // Identity-Aware Sync logic:
                                if (!incomingTargetId) {
                                    // Neutral broadcast (aggregate sent to everyone via WebSocket)
                                    // ONLY update aggregate data (options, totalVotes, etc.)
                                    // Preserve the current user's own vote selections
                                    finalUserVotes = existingVotes;
                                } else if (incomingTargetId === currentUserId) {
                                    // Direct update for CURRENT user (API Response)
                                    finalUserVotes = incomingVotes;
                                } else {
                                    // Leak protection: This update belongs to someone else
                                    console.warn(`[PollLeakProtection] Blocked leaked data for ${incomingTargetId}`);
                                    finalUserVotes = existingVotes;
                                }

                                return {
                                    ...m,
                                    poll: {
                                        ...pollData,
                                        currentUserVotes: finalUserVotes,
                                        // Preserve targetUserId when aggregate (null) arrives
                                        // to avoid losing user identity for subsequent syncs
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
