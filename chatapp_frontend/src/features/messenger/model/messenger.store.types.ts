import type {
    Conversation,
    Message,
    MessageReadReceipt,
    TypingEvent
} from '@/features/messenger/types/messenger.types';
import type { StateCreator } from 'zustand';

export interface ConversationSlice {
    activeView: 'chat' | 'contacts';
    conversations: Conversation[];
    activeConversationId: string | null;
    friendRequestCount: number;
    conversationsHasNext: boolean;
    conversationsPage: number;
    _loadedConversationIds: Set<string>;

    setActiveView: (view: 'chat' | 'contacts') => void;
    setConversations: (conversations: Conversation[], hasNext?: boolean, page?: number) => void;
    appendConversations: (conversations: Conversation[], hasNext: boolean, page: number) => void;
    setActiveConversation: (id: string | null) => void;
    hoistConversation: (conversation: Conversation) => void;
    setFriendRequestCount: (count: number) => void;
    pinConversation: (id: string) => void;
    unpinConversation: (id: string) => void;
    incrementUnreadCount: (conversationId: string) => void;
    resetUnreadCount: (conversationId: string) => void;
}

export interface MessageSlice {
    messages: Record<string, Message[]>;
    messagesPagination: Record<string, { hasNext: boolean, page: number }>;

    addMessage: (conversationId: string, message: Message) => void;
    setMessages: (conversationId: string, messages: Message[], hasNext?: boolean, page?: number) => void;
    appendMessages: (conversationId: string, messages: Message[], hasNext: boolean, page: number) => void;
    prependMessages: (conversationId: string, messages: Message[], hasNext: boolean, page: number) => void;
    updateMessageReactions: (conversationId: string, messageId: string, reactionEvent: { emoji: string; userId: string; action: 'ADD' | 'REMOVE' }) => void;
    updatePollData: (conversationId: string, pollData: Message['poll']) => void;
    updateMessageStatus: (conversationId: string, messageId: string, status: Message['status']) => void;
    updateMessage: (conversationId: string, message: Message) => void;
    addReadReceipt: (conversationId: string, messageId: string, readReceipt: MessageReadReceipt) => void;
    removeMessage: (conversationId: string, messageId: string) => void;
}

export interface TypingSlice {
    typingUsers: Record<string, TypingEvent[]>;

    setTyping: (event: TypingEvent) => void;
    clearTyping: (conversationId: string) => void;
}

export interface UISlice {
    loading: boolean;
    error: string | null;
    isSidebarOpen: boolean;

    setError: (error: string | null) => void;
    setLoading: (loading: boolean) => void;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;
}

export type MessengerState = ConversationSlice & MessageSlice & TypingSlice & UISlice;

export type MessengerSlice<T> = StateCreator<
    MessengerState,
    [["zustand/devtools", never]],
    [],
    T
>;
