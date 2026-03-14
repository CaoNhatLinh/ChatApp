import { useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMessengerStore, EMPTY_TYPING } from '@/features/messenger/model/messenger.store';
import { realtimeService } from '@/shared/websocket/realtime-service';
import {
    getConversations,
    getConversationById,
    getMessages,
    sendMessageHttp,
    editMessage as editMessageApi,
    deleteMessage as deleteMessageApi,
    getMessageRevisions as getMessageRevisionsApi,
    markMessageAsRead,
    mapToMessage,
    pinConversation as pinConversationApi,
    togglePinMessage,
    unpinConversation as unpinConversationApi,
    uploadFiles,
    type BackendMessage
} from '../api/messenger.api';
import { getReceivedRequests } from '@/features/relationships/api/friends.api';
import type { FriendRequestsResponse } from '@/features/relationships/api/friends.api';
import { subscribePresence, getBatchPresence as getBatchPresenceApi } from '@/features/presence/api/presence.api';
import { usePresenceStore } from '@/features/presence/model/presence.store';
import type {
    Conversation,
    Message,
    MessageRevision,
    SendMessageRequest,
    MessageType,
    User,
    TypingEvent
} from '../types/messenger.types';
import type { ConversationSlice, MessageSlice } from './messenger.store.types';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { logger } from '@/shared/lib/logger';
import { useNotificationStore } from '@/features/notifications/model/notification.store';

interface UseMessengerResult {
    initMessenger: () => Promise<void>;
    selectConversation: (conversationId: string | null) => Promise<void>;
    loadMoreConversations: () => Promise<void>;
    loadMoreMessages: (conversationId: string) => Promise<void>;
    sendMessage: (content: string, type?: MessageType, options?: Partial<SendMessageRequest>) => Promise<void>;
    editMessage: (messageId: string, content: string) => Promise<Message | null>;
    deleteMessage: (messageId: string) => Promise<Message | null>;
    loadMessageRevisions: (messageId: string) => Promise<MessageRevision[]>;
    pinMessage: (messageId: string) => Promise<void>;
    uploadMessageFiles: (files: File[]) => Promise<SendMessageRequest['attachments']>;
    sendTyping: (isTyping: boolean) => void;
    loading: boolean;
    error: string | null;
    isSidebarOpen: boolean;
    conversations: Conversation[];
    conversationsHasNext: boolean;
    activeView: ConversationSlice['activeView'];
    activeConversationId: string | null;
    messagesPagination: MessageSlice['messagesPagination'];
    typingUsers: TypingEvent[];
    setActiveView: ConversationSlice['setActiveView'];
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;
    pinConversation: (conversationId: string) => Promise<void>;
    unpinConversation: (conversationId: string) => Promise<void>;
    hoistConversation: ConversationSlice['hoistConversation'];
    friendRequestCount: number;
}

export const useMessenger = (): UseMessengerResult => {
    const {
        setActiveView,
        setConversations,
        addMessage,
        setMessages,
        setActiveConversation,
        setLoading,
        setError,
        setSidebarOpen,
        toggleSidebar,
        setFriendRequestCount,
        pinConversationStore,
        unpinConversationStore,
        hoistConversation,
        updateMessageStatus,
        updateMessage,
        resetUnreadCount
    } = useMessengerStore(useShallow(state => ({
        setActiveView: state.setActiveView,
        setConversations: state.setConversations,
        addMessage: state.addMessage,
        setMessages: state.setMessages,
        setActiveConversation: state.setActiveConversation,
        setLoading: state.setLoading,
        setError: state.setError,
        setSidebarOpen: state.setSidebarOpen,
        toggleSidebar: state.toggleSidebar,
        setFriendRequestCount: state.setFriendRequestCount,
        pinConversationStore: state.pinConversation,
        unpinConversationStore: state.unpinConversation,
        hoistConversation: state.hoistConversation,
        updateMessageStatus: state.updateMessageStatus,
        updateMessage: state.updateMessage,
        resetUnreadCount: state.resetUnreadCount
    })));

    const {
        activeView,
        activeConversationId,
        loading,
        error,
        isSidebarOpen,
        conversations,
        conversationsPage,
        conversationsHasNext,
        messagesPagination,
        appendConversations,
        prependMessages,
        typingUsers,
        friendRequestCount
    } = useMessengerStore(useShallow(state => ({
        activeView: state.activeView,
        activeConversationId: state.activeConversationId,
        loading: state.loading,
        error: state.error,
        isSidebarOpen: state.isSidebarOpen,
        conversations: state.conversations,
        conversationsPage: state.conversationsPage,
        conversationsHasNext: state.conversationsHasNext,
        messagesPagination: state.messagesPagination,
        appendConversations: state.appendConversations,
        prependMessages: state.prependMessages,
        friendRequestCount: state.friendRequestCount,
        typingUsers: state.activeConversationId ? (state.typingUsers[state.activeConversationId] || EMPTY_TYPING) : EMPTY_TYPING
    })));

    const { user, token } = useAuthStore(useShallow(state => ({
        user: state.user,
        token: state.token
    })));

    // Track conversations being fetched to avoid duplicate API calls
    const fetchingConversationsRef = useRef<Set<string>>(new Set());

    /* --- Data Initialization --- */

    const initMessenger = useCallback(async () => {
        if (!token) return;

        setLoading(true);
        try {
            const [convResponse, requestResponse] = await Promise.all([
                getConversations(0, 30),
                user?.userId ? getReceivedRequests(0, 100) : Promise.resolve({ content: [] })
            ]);

            setConversations(convResponse.content, convResponse.hasNext, convResponse.number);

            // Presence management: Await initial status pull to avoid "Offline" lag
            if (user?.userId) {
                const participantsToWatch = new Set<string>();
                convResponse.content.forEach(conv => {
                    if (conv.otherParticipant?.userId) {
                        participantsToWatch.add(conv.otherParticipant.userId);
                    }
                });

                if (participantsToWatch.size > 0) {
                    const ids = Array.from(participantsToWatch);
                    // Start watching via WS (event loop)
                    void subscribePresence(ids);

                    // Await batch presence pull (direct sync)
                    try {
                        const presences = await getBatchPresenceApi(ids);
                        usePresenceStore.getState().setMultiplePresences(presences);
                        logger.debug('Messenger presence initialized for', ids.length, 'users');
                    } catch (pErr) {
                        logger.warn('Failed to fetch initial presence batch', pErr);
                    }
                }
            }

            // Set friend request count
            if (requestResponse && requestResponse.content) {
                const totalCount = requestResponse.content.reduce((acc: number, r: FriendRequestsResponse) => acc + (r.userDetails?.length || 0), 0);
                setFriendRequestCount(totalCount);
            }

            // Connect realtime if not connected
            if (!realtimeService.isConnected()) {
                await realtimeService.connect(token);
            }

            // Subscribe to global user events (friend status, etc)
            if (user?.userId) {
                realtimeService.subscribe(`/user/${user.userId}/queue/notifications`, (payload) => {
                    logger.debug('Received user notification', payload);
                    // Handle global notifications if needed
                });

                // Subscribe to friend requests
                realtimeService.subscribe(`/user/queue/friend-requests`, (payload: { status?: string }) => {
                    if (payload.status === 'PENDING') {
                        setFriendRequestCount(useMessengerStore.getState().friendRequestCount + 1);
                    } else if (payload.status === 'ACCEPTED' || payload.status === 'UNFRIENDED') {
                        // Refresh count or just decrement/increment
                        // For safety, we can re-fetch or just update local state if we knew the previous state
                        // Here let's just trigger a re-fetch of the count if we want it perfect
                        void getReceivedRequests(0, 100).then(res => {
                            const totalCount = res.content.reduce((acc: number, r: FriendRequestsResponse) => acc + (r.userDetails?.length || 0), 0);
                            setFriendRequestCount(totalCount);
                        });
                    }
                });

                // Subscribe to per-user new-message notifications for conversation hoisting.
                // This fires for ALL conversations the user is a member of,
                // even ones not currently loaded in the sidebar.
                realtimeService.subscribe(`/topic/user/${user.userId}/new-message`, async (event: { conversationId: string; senderId: string }) => {
                    const convId = event.conversationId;
                    const loadedIds = useMessengerStore.getState()._loadedConversationIds;

                    // If conversation is already in the loaded list, addMessage already handles hoisting
                    if (loadedIds.has(convId)) return;

                    // Conversation is NOT loaded yet — fetch it from API and hoist
                    if (fetchingConversationsRef.current.has(convId)) return; // already fetching
                    fetchingConversationsRef.current.add(convId);

                    try {
                        const conversation = await getConversationById(convId);
                        useMessengerStore.getState().hoistConversation(conversation);

                        // Also subscribe to presence if it's a DM
                        if (conversation.otherParticipant?.userId) {
                            void subscribePresence([conversation.otherParticipant.userId]);
                            void getBatchPresenceApi([conversation.otherParticipant.userId]).then(pBatch => {
                                usePresenceStore.getState().setMultiplePresences(pBatch);
                            });
                        }
                    } catch (err) {
                        logger.debug('Failed to fetch conversation for hoisting', convId, err);
                    } finally {
                        fetchingConversationsRef.current.delete(convId);
                    }
                });
            }

        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Không thể tải danh sách hội thoại.';
            setError(errorMessage);
            console.error('[useMessenger] Error initializing messenger:', err instanceof Error ? err.message : err);
        } finally {
            setLoading(false);
        }
    }, [token, user?.userId, setConversations, setLoading, setError, setFriendRequestCount]);

    /* --- Conversation Selection & Message Loading --- */

    const selectConversation = useCallback(async (conversationId: string | null) => {
        setActiveConversation(conversationId);
        if (!conversationId) return;
        resetUnreadCount(conversationId);
        void useNotificationStore.getState().markConversationAsRead(conversationId);

        // Ensure we are watching the other participant if it's a DM
        const conv = useMessengerStore.getState().conversations.find(c => c.conversationId === conversationId);
        if (conv?.otherParticipant?.userId) {
            void subscribePresence([conv.otherParticipant.userId]);
            void getBatchPresenceApi([conv.otherParticipant.userId]).then(pBatch => {
                usePresenceStore.getState().setMultiplePresences(pBatch);
            });
        }

        // Skip fetch if we already have cached messages for this conversation.
        // New messages arrive via WebSocket so the cache stays fresh.
        const cachedMessages = useMessengerStore.getState().messages[conversationId];
        if (cachedMessages && cachedMessages.length > 0) return;

        try {
            const response = await getMessages(conversationId, { page: 0, size: 30 });
            setMessages(conversationId, response.content, response.hasNext, response.number);

            await Promise.all(
                response.content
                    .filter(message => message.sender.userId !== user?.userId && !message.isDeleted)
                    .map(message => markMessageAsRead(conversationId, message.messageId).catch(() => undefined))
            );

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Không thể tải tin nhắn.');
            console.error('[useMessenger] Error selecting conversation:', err instanceof Error ? err.message : err);
        }
    }, [resetUnreadCount, setActiveConversation, setMessages, setError, user?.userId]);


    const loadMoreConversations = useCallback(async () => {
        if (!conversationsHasNext || loading) return;

        try {
            const nextPage = conversationsPage + 1;
            const response = await getConversations(nextPage, 30);
            appendConversations(response.content, response.hasNext, response.number);
        } catch (err) {
            console.error('[useMessenger] Error loading more conversations:', err);
        }
    }, [conversationsHasNext, conversationsPage, loading, appendConversations]);

    const loadMoreMessages = useCallback(async (conversationId: string) => {
        const pagination = messagesPagination[conversationId];
        if (!pagination?.hasNext || loading) return;

        try {
            const nextPage = pagination.page + 1;
            const response = await getMessages(conversationId, { page: nextPage, size: 20 });
            prependMessages(conversationId, response.content, response.hasNext, response.number);
        } catch (err) {
            console.error('[useMessenger] Error loading more messages:', err);
        }
    }, [messagesPagination, loading, prependMessages]);

    /* --- Message Actions --- */

    const sendMessage = useCallback(async (
        content: string,
        type: MessageType = 'TEXT',
        options?: { replyToId?: string; attachments?: SendMessageRequest['attachments'] }
    ) => {
        if (!activeConversationId || !user) return;

        const request: SendMessageRequest = {
            conversationId: activeConversationId,
            content,
            type,
            replyToId: options?.replyToId,
            attachments: options?.attachments
        };

        // Optimistic Update
        const tempId = `temp-${Date.now()}`;
        const tempMessage: Message = {
            messageId: tempId,
            conversationId: activeConversationId,
            sender: user,
            content,
            type,
            attachments: [],
            reactions: [],
            readReceipts: [],
            isForwarded: false,
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'sending'
        };

        addMessage(activeConversationId, tempMessage);

        try {
            // Choose between REST and WS based on configuration
            // Here we use REST for reliability of persistence stage
            await sendMessageHttp(request);

            // The websocket will broadcast the REAL message, which will replace temp message 
            // if we implement logic to match tempId (but here we just rely on addMessage de-duplication)
            // For now, addMessage in store will handle server-sent message.
        } catch (err: unknown) {
            console.error('[useMessenger] Error sending message:', err instanceof Error ? err.message : err);
            // Update status to failed
            updateMessageStatus(activeConversationId, tempId, 'failed');
        }
    }, [activeConversationId, user, addMessage, updateMessageStatus]);

    const editMessage = useCallback(async (messageId: string, content: string) => {
        if (!activeConversationId) return null;
        const updated = await editMessageApi(activeConversationId, messageId, content);
        updateMessage(activeConversationId, updated);
        return updated;
    }, [activeConversationId, updateMessage]);

    const deleteMessage = useCallback(async (messageId: string) => {
        if (!activeConversationId) return null;
        const updated = await deleteMessageApi(activeConversationId, messageId);
        updateMessage(activeConversationId, updated);
        return updated;
    }, [activeConversationId, updateMessage]);

    const loadMessageRevisions = useCallback(async (messageId: string): Promise<MessageRevision[]> => {
        if (!activeConversationId) return [];
        return getMessageRevisionsApi(activeConversationId, messageId);
    }, [activeConversationId]);

    const pinMessage = useCallback(async (messageId: string) => {
        if (!activeConversationId) return;
        await togglePinMessage(activeConversationId, messageId);
    }, [activeConversationId]);

    const uploadMessageFiles = useCallback(async (files: File[]) => uploadFiles(files), []);

    const sendTyping = useCallback((isTyping: boolean) => {
        if (!activeConversationId || !user) return;
        realtimeService.publish(`/app/typing`, {
            conversationId: activeConversationId,
            user: {
                userId: user.userId,
                userName: user.userName,
                displayName: user.displayName
            },
            isTyping
        });
    }, [activeConversationId, user]);

    const pinConversation = useCallback(async (conversationId: string) => {
        try {
            await pinConversationApi(conversationId);
            pinConversationStore(conversationId);
        } catch (err) {
            console.error('[useMessenger] Error pinning conversation:', err);
        }
    }, [pinConversationStore]);

    const unpinConversation = useCallback(async (conversationId: string) => {
        try {
            await unpinConversationApi(conversationId);
            unpinConversationStore(conversationId);
        } catch (err) {
            console.error('[useMessenger] Error unpinning conversation:', err);
        }
    }, [unpinConversationStore]);

    return {
        initMessenger,
        selectConversation,
        loadMoreConversations,
        loadMoreMessages,
        sendMessage,
        editMessage,
        deleteMessage,
        loadMessageRevisions,
        pinMessage,
        uploadMessageFiles,
        sendTyping,
        loading,
        error,
        isSidebarOpen,
        conversations,
        conversationsHasNext,
        activeView,
        activeConversationId,
        messagesPagination,
        typingUsers,
        setActiveView,
        setSidebarOpen,
        toggleSidebar,
        pinConversation,
        unpinConversation,
        hoistConversation,
        friendRequestCount
    };
};

/**
 * useMessengerSetup
 * This hook handles global initialization and WebSocket subscriptions.
 * It MUST be called exactly once in the tree (e.g., in MessengerLayout) 
 * to prevent duplicate subscriptions and API calls.
 */
export const useMessengerSetup = (initMessenger: () => Promise<void>) => {
    const {
        activeConversationId,
        loading,
        conversations,
        addMessage,
        setTyping,
        clearTyping,
        updateMessageReactions,
        updatePollData,
        addReadReceipt,
        updateMessagePinStatus,
        addMessageAttachment
    } = useMessengerStore(useShallow(state => ({
        activeConversationId: state.activeConversationId,
        loading: state.loading,
        conversations: state.conversations,
        addMessage: state.addMessage,
        setTyping: state.setTyping,
        clearTyping: state.clearTyping,
        updateMessageReactions: state.updateMessageReactions,
        updatePollData: state.updatePollData,
        addReadReceipt: state.addReadReceipt,
        updateMessagePinStatus: state.updateMessagePinStatus,
        addMessageAttachment: state.addMessageAttachment
    })));

    const { user, token } = useAuthStore();

    useEffect(() => {
        let mounted = true;

        // Only run setup if not loading and we don't have conversations
        const hasConversations = conversations && conversations.length > 0;

        if (mounted && !hasConversations && !loading && token) {
            void initMessenger();
        }

        return () => {
            mounted = false;
        };
    }, [initMessenger, loading, token, conversations]);

    // Handle Realtime Subscriptions with Lifecycle
    useEffect(() => {
        if (!activeConversationId || !user) return;

        logger.debug(`[useMessengerSetup] Subscribing to conversation: ${activeConversationId}`);

        // Subscribe to messages
        const unsubMessage = realtimeService.subscribe(`/topic/conversation/${activeConversationId}`, (raw: Partial<BackendMessage>) => {
            const msg = mapToMessage(raw);
            if (!msg.messageId) return;
            addMessage(activeConversationId, msg);
            if (msg.sender.userId !== user.userId && !msg.isDeleted) {
                void markMessageAsRead(activeConversationId, msg.messageId);
            }
        });

        const typingTopic = `/topic/conversation/${activeConversationId}/typing`;
        const unsubTyping = realtimeService.subscribe(typingTopic, (event: { isTyping?: boolean; typing?: boolean; user?: { userId?: string | number; userName?: string; displayName?: string; avatarUrl?: string } }) => {
            const isTyping = event.isTyping !== undefined ? event.isTyping : event.typing;
            const rawUser = event.user;

            if (!rawUser) return;

            const eventUserId = String(rawUser.userId ?? '');
            if (!eventUserId || eventUserId === user.userId) return;

            const typingEvent: TypingEvent = {
                conversationId: activeConversationId,
                user: {
                    userId: eventUserId,
                    userName: String(rawUser.userName ?? ''),
                    displayName: String(rawUser.displayName ?? rawUser.userName ?? 'User'),
                    avatarUrl: rawUser.avatarUrl ?? undefined
                } as User,
                isTyping: Boolean(isTyping)
            };

            setTyping(typingEvent);
        });

        // Subscribe to reactions
        const unsubReactions = realtimeService.subscribe(
            `/topic/conversation/${activeConversationId}/reactions`,
            (event: { messageId: string; emoji: string; userId: string; action: 'ADD' | 'REMOVE' }) => {
                updateMessageReactions(activeConversationId, event.messageId, event);
            }
        );

        const unsubReadReceipts = realtimeService.subscribe(
            `/topic/conversation/${activeConversationId}/read`,
            (event: { messageId: string; readerId: string; readAt: string }) => {
                addReadReceipt(activeConversationId, event.messageId, {
                    readerId: event.readerId,
                    readAt: event.readAt,
                });
            }
        );

        // Subscribe to poll updates
        const unsubPolls = realtimeService.subscribe(
            `/topic/conversation/${activeConversationId}/polls`,
            (pollData: Message['poll']) => {
                updatePollData(activeConversationId, pollData);
            }
        );

        // Subscribe to pin updates
        const unsubPins = realtimeService.subscribe(
            `/topic/conversation/${activeConversationId}/pins`,
            (event: { messageId: string; action: 'PIN' | 'UNPIN' }) => {
                updateMessagePinStatus(activeConversationId, event.messageId, event.action === 'PIN');
            }
        );

        // Subscribe to attachment updates
        const unsubAttachments = realtimeService.subscribe(
            `/topic/conversation/${activeConversationId}/attachments`,
            (event: { messageId: string; attachment: Message['attachments'][0] }) => {
                addMessageAttachment(activeConversationId, event.messageId, event.attachment);
            }
        );

        return () => {
            logger.debug(`[useMessengerSetup] Unsubscribing from conversation: ${activeConversationId}`);
            unsubMessage();
            unsubTyping();
            unsubReactions();
            unsubReadReceipts();
            unsubPolls();
            unsubPins();
            unsubAttachments();
            clearTyping(activeConversationId);
        };
    }, [
        activeConversationId,
        user,
        addMessage,
        setTyping,
        updateMessageReactions,
        updatePollData,
        clearTyping,
        addReadReceipt,
        updateMessagePinStatus,
        addMessageAttachment
    ]);
};
