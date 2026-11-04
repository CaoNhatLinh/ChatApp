import type {
    Conversation,
    Message,
    MessageReadReceipt,
    MessagePinState,
    TypingEvent
} from '@/features/messenger/types/messenger.types';
import type { StateCreator } from 'zustand';

export type ConversationEntry = { conversationId: string; requestId: string } & (
    | { status: 'loading' }
    | { status: 'error'; reason: 'unavailable' | 'forbidden' | 'missing' | 'invalid' }
);

export interface ConversationSlice {
    activeView: 'chat' | 'contacts';
    conversations: Conversation[];
    conversationsPagination: { hasNext: boolean; nextCursor: string | null; loading: boolean };
    activeConversationId: string | null;
    conversationEntry: ConversationEntry | null;
    setConversationEntry: (entry: ConversationEntry | null) => void;
    isInitialized: boolean;
    friendRequestCount: number;
    resetState: () => void;

    setActiveView: (view: 'chat' | 'contacts') => void;
    setConversations: (conversations: Conversation[], pagination: { hasNext: boolean; nextCursor: string | null }) => void;
    appendConversations: (conversations: Conversation[], pagination: { hasNext: boolean; nextCursor: string | null }) => void;
    setConversationsLoading: (loading: boolean) => void;
    setActiveConversation: (id: string | null) => void;
    hoistConversation: (conversation: Conversation) => void;
    setFriendRequestCount: (count: number) => void;
    pinConversation: (id: string) => void;
    unpinConversation: (id: string) => void;
    setConversationUnreadCount: (conversationId: string, unreadCount: number) => void;
    updateConversationNotificationPolicy: (
        conversationId: string,
        policy: Pick<Conversation, 'defaultNotificationLevel' | 'notificationOverride'>,
    ) => void;
    updateConversationOwner: (conversationId: string, ownerId: string) => void;
    updateConversationChatPolicy: (
        conversationId: string,
        policy: Pick<Conversation, 'chatMode' | 'slowModeSeconds'>,
    ) => void;
    upsertConversationFromMessage: (message: Message) => void;
    resetUnreadCount: (conversationId: string) => void;
}

export interface MessageHistoryCommit {
    before: readonly Message[];
    hasNext: boolean;
    page: number;
    nextCursor?: string;
}

type MessageHistoryRequest = {
    conversationId: string;
    requestId: string;
    status: 'loading' | 'error';
};

export interface MessageSlice {
    messagePinStates: Record<string, MessagePinState>;
    applyMessagePinState: (state: MessagePinState) => void;
    messages: Record<string, Message[]>;
    messagesPagination: Record<string, { hasNext: boolean, page: number; nextCursor?: string; fetchedAt?: number }>;
    initialMessageHistory: MessageHistoryRequest | null;
    setInitialMessageHistory: (history: MessageHistoryRequest | null) => void;
    olderMessageHistory: MessageHistoryRequest | null;
    setOlderMessageHistory: (history: MessageHistoryRequest | null) => void;
    unavailableMessageHistory: Record<string, true>;
    setMessageHistoryUnavailable: (conversationId: string, unavailable: boolean) => void;

    addMessage: (conversationId: string, message: Message) => void;
    setMessages: (conversationId: string, messages: Message[], context: MessageHistoryCommit) => void;
    appendMessages: (conversationId: string, messages: Message[], context: MessageHistoryCommit) => void;
    prependMessages: (conversationId: string, messages: Message[], context: MessageHistoryCommit) => void;
    updateMessageReactions: (conversationId: string, messageId: string, reactionEvent: { emoji: string; userId: string; action: 'ADD' | 'REMOVE' }) => void;
    updatePollData: (conversationId: string, pollData: Message['poll']) => void;
    updateMessageStatus: (
        conversationId: string,
        messageId: string,
        status: Message['status'],
        retry?: Pick<Message, 'retryNeedsAttachmentCheck' | 'retryAttachmentUnavailable'>
    ) => void;
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
