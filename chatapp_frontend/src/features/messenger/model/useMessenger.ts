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
    markMessagesAsRead,
    getConversationUnreadCount,
    mapToMessage,
    pinConversation as pinConversationApi,
    unpinConversation as unpinConversationApi,
    togglePinMessage as pinMessageApi,
    uploadFiles,
    type BackendMessage
} from '../api/messenger.api';
import { getReceivedRequests } from '@/features/relationships/api/friends.api';
import type { FriendshipStatusResponse } from '@/features/relationships/api/friends.api';
import { useFriendStore } from '@/features/relationships/model/friend.store';
import type {
    Conversation,
    Message,
    MessageRevision,
    SendMessageRequest,
    MessageType,
    TypingEvent
} from '../types/messenger.types';
import type { ConversationSlice, MessageSlice } from './messenger.store.types';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { logger } from '@/shared/lib/logger';
import { useNotificationStore } from '@/features/notifications/model/notification.store';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';

const MESSAGES_TTL_MS = 60_000;
const CONVERSATION_PAGE_SIZE = 30;
const INITIAL_MESSAGES_PAGE_SIZE = 30;
const LOAD_MORE_MESSAGES_PAGE_SIZE = 20;
const initTracker = { key: '', promise: null as Promise<void> | null };
const initMessengerSubscriptions = new Map<string, Array<() => void>>();

const clearInitSubscriptions = (key: string): void => {
    const unsubscribers = initMessengerSubscriptions.get(key) || [];
    unsubscribers.forEach((unsubscribe) => {
        try {
            unsubscribe();
        } catch (error) {
            logger.debug('[useMessenger] Failed to unsubscribe previous init subscription', error);
        }
    });
    initMessengerSubscriptions.delete(key);
};

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
        upsertConversationFromMessage,
        updateMessageStatus,
        updateMessage,
        resetUnreadCount,
        setConversationUnreadCount
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
        upsertConversationFromMessage: state.upsertConversationFromMessage,
        updateMessageStatus: state.updateMessageStatus,
        updateMessage: state.updateMessage,
        resetUnreadCount: state.resetUnreadCount,
        setConversationUnreadCount: state.setConversationUnreadCount
    })));

    const {
        activeView,
        activeConversationId,
        loading,
        error,
        isSidebarOpen,
        conversations,
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
        conversationsHasNext: state.conversationsHasNext,
        messagesPagination: state.messagesPagination,
        appendConversations: state.appendConversations,
        prependMessages: state.prependMessages,
        friendRequestCount: state.friendRequestCount,
        typingUsers: state.activeConversationId ? (state.typingUsers[state.activeConversationId] || EMPTY_TYPING) : EMPTY_TYPING
    })));

    const isInitialized = useMessengerStore((state) => state.isInitialized);

    const { user, token } = useAuthStore(useShallow(state => ({
        user: state.user,
        token: state.token,
    })));

    const refreshConversationSeqRef = useRef<Map<string, number>>(new Map());
    const loadMoreInFlightRef = useRef<Set<string>>(new Set());
    const loadMoreConversationsInFlightRef = useRef(false);
    const conversationLoadRequestRef = useRef(0);

    const refreshConversationSummary = useCallback(async (conversationId: string) => {
        if (!conversationId) return;
        const requestId = Date.now();
        refreshConversationSeqRef.current.set(conversationId, requestId);

        try {
            const conversation = await getConversationById(conversationId);
            if (refreshConversationSeqRef.current.get(conversationId) !== requestId) return;
            useMessengerStore.getState().hoistConversation(conversation);
            const activeId = useMessengerStore.getState().activeConversationId;
            if (activeId !== conversationId) {
                const unreadCount = await getConversationUnreadCount(conversationId);
                if (refreshConversationSeqRef.current.get(conversationId) !== requestId) return;
                useMessengerStore.getState().setConversationUnreadCount(conversationId, unreadCount);
            }
        } catch (err) {
            logger.debug('Failed to refresh conversation summary', conversationId, err);
        } finally {
            if (refreshConversationSeqRef.current.get(conversationId) === requestId) {
                refreshConversationSeqRef.current.delete(conversationId);
            }
        }
    }, []);

    const initMessenger = useCallback(async () => {
        if (!token) return;

        const initKey = `${token}:${user?.userId ?? 'anon'}`;
        if (initTracker.key === initKey && initTracker.promise) {
            await initTracker.promise;
            return;
        }

        if (initTracker.key && initTracker.key !== initKey) {
            clearInitSubscriptions(initTracker.key);
        }

        if (isInitialized && initTracker.key === initKey) {
            return;
        }

        const task = (async () => {
            setLoading(true);
            const subscriptionUnsubs: Array<() => void> = [];
    const registerSubscription = (destination: string, callback: (payload: unknown) => void): void => {
                const unsubscribe = realtimeService.subscribe(destination, (payload) => callback(payload));
                subscriptionUnsubs.push(unsubscribe);
            };

            clearInitSubscriptions(initKey);

            try {
                const [convResponse, requestResponse] = await Promise.all([
                    getConversations(0, CONVERSATION_PAGE_SIZE),
                    user?.userId ? getReceivedRequests(100) : Promise.resolve<FriendshipStatusResponse | null>(null)
                ]);

                setConversations(convResponse.content, convResponse.hasNext, convResponse.number);

                if (requestResponse) {
                    setFriendRequestCount(requestResponse.userDetails.length);
                }

                if (!realtimeService.isConnected()) {
                    await realtimeService.connect(token);
                }

                if (user?.userId) {
                    registerSubscription(`/user/queue/friend-requests`, (payload) => {
                        if (!payload || typeof payload !== 'object') {
                            return;
                        }
                        const requestStatus = (payload as { status?: unknown }).status;
                        if (requestStatus !== 'PENDING' && requestStatus !== 'ACCEPTED' && requestStatus !== 'UNFRIENDED') {
                            return;
                        }

                        if (requestStatus === 'PENDING') {
                            setFriendRequestCount(useMessengerStore.getState().friendRequestCount + 1);
                        } else if (requestStatus === 'ACCEPTED' || requestStatus === 'UNFRIENDED') {
                            void getReceivedRequests(100).then(res => {
                                setFriendRequestCount(res.userDetails.length);
                            });
                        }
                    });

                    // Subscribe to per-user new-message notifications for conversation hoisting.
                    registerSubscription(`/topic/user/${user.userId}/new-message`, (event) => {
                        if (!event || typeof event !== 'object') {
                            return;
                        }
                        const eventConversationId = (event as { conversationId?: unknown }).conversationId;
                        if (typeof eventConversationId !== 'string') {
                            return;
                        }
                        const convId = eventConversationId;
                        if (!convId) return;
                        const activeConversationId = useMessengerStore.getState().activeConversationId;
                        const hasConversationInList = useMessengerStore
                            .getState()
                            .conversations
                            .some((conversation) => conversation.conversationId === convId);

                        if (activeConversationId === convId && hasConversationInList) return;
                        void refreshConversationSummary(convId);
                    });

                    registerSubscription(`/user/queue/conversation-list-update`, (event) => {
                        if (!event || typeof event !== 'object') {
                            return;
                        }
                        const rawConversationId = (event as { conversationId?: unknown }).conversationId;
                        if (
                            rawConversationId === null ||
                            rawConversationId === undefined ||
                            (typeof rawConversationId !== 'string' && typeof rawConversationId !== 'number')
                        ) {
                            return;
                        }
                        const conversationId = String(rawConversationId);
                        void refreshConversationSummary(conversationId);
                    });
                    initMessengerSubscriptions.set(initKey, subscriptionUnsubs);
                }
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : MESSENGER_COPY.errors.loadConversationsFailed;
                clearInitSubscriptions(initKey);
                setError(errorMessage);
                logger.error('[useMessenger] Error initializing messenger:', err instanceof Error ? err.message : err);
            } finally {
                setLoading(false);
            }
        })();

        initTracker.key = initKey;
        initTracker.promise = task;

        try {
            await task;
        } finally {
            if (initTracker.promise === task) {
                initTracker.promise = null;
            }
        }
    }, [
        token,
        user?.userId,
        isInitialized,
        setConversations,
        setLoading,
        setError,
        setFriendRequestCount,
        refreshConversationSummary,
    ]);

        const selectConversation = useCallback(async (conversationId: string | null) => {
        setActiveConversation(conversationId);
        if (!conversationId) return;

        const requestId = ++conversationLoadRequestRef.current;

        const isConversationLoaded = useMessengerStore.getState().conversations.some(
            (conversation) => conversation.conversationId === conversationId,
        );

        if (!isConversationLoaded) {
            await refreshConversationSummary(conversationId);
        }

        resetUnreadCount(conversationId);
        void useNotificationStore.getState().markConversationAsRead(conversationId);
        void getConversationUnreadCount(conversationId)
            .then((count) => {
                if (requestId !== conversationLoadRequestRef.current) return;
                setConversationUnreadCount(conversationId, count);
            })
            .catch((error: unknown) => {
                logger.debug('Failed to refresh conversation unread count', error);
            });

        const cachedMessages = useMessengerStore.getState().messages[conversationId];
        const pagination = useMessengerStore.getState().messagesPagination[conversationId];

        if (cachedMessages && cachedMessages.length > 0 && pagination?.fetchedAt && Date.now() - pagination.fetchedAt <= MESSAGES_TTL_MS) {
            const unreadMessages = cachedMessages
                .filter(message => !message.isDeleted && message.sender.userId !== user?.userId);

            if (unreadMessages.length > 0) {
                void markMessagesAsRead(conversationId, unreadMessages).catch((error: unknown) => {
                    logger.debug('Failed to mark cached messages as read', error);
                });
            }

            void getConversationUnreadCount(conversationId)
                .then((count) => {
                    if (requestId !== conversationLoadRequestRef.current) return;
                    setConversationUnreadCount(conversationId, count);
                })
                .catch((error: unknown) => {
                    logger.debug('Failed to refresh cached conversation unread count', error);
                });
            return;
        }

        try {
            if (requestId !== conversationLoadRequestRef.current) return;
            const response = await getMessages(conversationId, { page: 0, size: INITIAL_MESSAGES_PAGE_SIZE });
            if (requestId !== conversationLoadRequestRef.current) return;
            setMessages(conversationId, response.content, response.hasNext, response.number, response.nextCursor);

            const unreadMessages = response.content
                .filter(message => !message.isDeleted && message.sender.userId !== user?.userId);

            if (unreadMessages.length > 0) {
                await markMessagesAsRead(conversationId, unreadMessages);
            }

            if (requestId !== conversationLoadRequestRef.current) return;
            const unreadCount = await getConversationUnreadCount(conversationId);
            if (requestId !== conversationLoadRequestRef.current) return;
            setConversationUnreadCount(conversationId, unreadCount);
        } catch (err: unknown) {
            if (requestId !== conversationLoadRequestRef.current) return;
            setError(err instanceof Error ? err.message : MESSENGER_COPY.errors.loadMessagesFailed);
            logger.error('[useMessenger] Error selecting conversation:', err instanceof Error ? err.message : err);
        }
    }, [
        resetUnreadCount,
        refreshConversationSummary,
        setActiveConversation,
        setMessages,
        setError,
        setConversationUnreadCount,
        user?.userId,
    ]);

    const loadMoreConversations = useCallback(async () => {
        if (loadMoreConversationsInFlightRef.current) return;
        loadMoreConversationsInFlightRef.current = true;

        try {
            const state = useMessengerStore.getState();
            if (state.loading || !state.conversationsHasNext) {
                return;
            }

            const nextPage = state.conversationsPage + 1;
            const response = await getConversations(nextPage, CONVERSATION_PAGE_SIZE);
            appendConversations(response.content, response.hasNext, response.number);
        } catch (err) {
            console.error('[useMessenger] Error loading more conversations:', err);
        } finally {
            loadMoreConversationsInFlightRef.current = false;
        }
    }, [appendConversations]);

        const loadMoreMessages = useCallback(async (conversationId: string) => {
        if (loadMoreInFlightRef.current.has(conversationId)) {
            return;
        }

        const state = useMessengerStore.getState();
        const pagination = state.messagesPagination[conversationId];
        if (!pagination?.hasNext || state.loading) return;

        loadMoreInFlightRef.current.add(conversationId);

        try {
            const nextPage = pagination.page + 1;
            const response = await getMessages(conversationId, {
                page: nextPage,
                size: LOAD_MORE_MESSAGES_PAGE_SIZE,
                before: pagination.nextCursor,
            });
            prependMessages(conversationId, response.content, response.hasNext, response.number, response.nextCursor);
        } catch (err) {
            console.error('[useMessenger] Error loading more messages:', err);
        } finally {
            loadMoreInFlightRef.current.delete(conversationId);
        }
    }, [prependMessages]);

    const sendMessage = useCallback(async (
        content: string,
        type: MessageType = 'TEXT',
        options?: Partial<Pick<SendMessageRequest, 'clientMessageId' | 'replyToId' | 'attachments'>>
    ) => {
        const trimmedContent = content.trim();
        if (!activeConversationId || !user || (!trimmedContent && (!options?.attachments || options.attachments.length === 0))) return;

        const clientMessageId = options?.clientMessageId ?? crypto.randomUUID();
        const request: SendMessageRequest = {
            clientMessageId,
            conversationId: activeConversationId,
            content: trimmedContent,
            type,
            replyToId: options?.replyToId,
            attachments: options?.attachments
        };

        const tempId = `temp-${clientMessageId}`;
        const tempMessage: Message = {
            messageId: tempId,
            clientMessageId,
            conversationId: activeConversationId,
            sender: user,
            content,
            type,
            attachments: options?.attachments ? [...options.attachments] : [],
            reactions: [],
            readReceipts: [],
            isForwarded: false,
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'sending'
        };

        addMessage(activeConversationId, tempMessage);
        upsertConversationFromMessage(tempMessage);

        try {
            await sendMessageHttp(request);
        } catch (err: unknown) {
            console.error('[useMessenger] Error sending message:', err instanceof Error ? err.message : err);
            setError(MESSENGER_COPY.errors.sendMessageFailed);
            updateMessageStatus(activeConversationId, tempId, 'failed');
        }
    }, [activeConversationId, user, addMessage, upsertConversationFromMessage, updateMessageStatus, setError]);

    const editMessage = useCallback(async (messageId: string, content: string) => {
        if (!activeConversationId) return null;
        const messageBucket = useMessengerStore.getState().messages[activeConversationId]
            ?.find((message) => message.messageId === messageId)?.messageBucket;
        if (!messageBucket) throw new Error('Message bucket is required');
        const updated = await editMessageApi(activeConversationId, messageBucket, messageId, content);
        updateMessage(activeConversationId, updated);
        return updated;
    }, [activeConversationId, updateMessage]);

    const deleteMessage = useCallback(async (messageId: string) => {
        if (!activeConversationId) return null;
        const messageBucket = useMessengerStore.getState().messages[activeConversationId]
            ?.find((message) => message.messageId === messageId)?.messageBucket;
        if (!messageBucket) throw new Error('Message bucket is required');
        const updated = await deleteMessageApi(activeConversationId, messageBucket, messageId);
        updateMessage(activeConversationId, updated);
        return updated;
    }, [activeConversationId, updateMessage]);

    const loadMessageRevisions = useCallback(async (messageId: string): Promise<MessageRevision[]> => {
        if (!activeConversationId) return [];
        const messageBucket = useMessengerStore.getState().messages[activeConversationId]
            ?.find((message) => message.messageId === messageId)?.messageBucket;
        if (!messageBucket) throw new Error('Message bucket is required');
        return getMessageRevisionsApi(activeConversationId, messageBucket, messageId);
    }, [activeConversationId]);

    const pinMessage = useCallback(async (messageId: string) => {
        if (!activeConversationId) return;
        const messageBucket = useMessengerStore.getState().messages[activeConversationId]
            ?.find((message) => message.messageId === messageId)?.messageBucket;
        if (!messageBucket) throw new Error('Message bucket is required');
        await pinMessageApi(activeConversationId, messageBucket, messageId);
    }, [activeConversationId]);

    const uploadMessageFiles = useCallback(async (files: File[]) => {
        return uploadFiles(files);
    }, []);

    const sendTyping = useCallback((isTyping: boolean) => {
        if (!activeConversationId || !user) return;
        realtimeService.publish(`/app/typing`, {
            conversationId: activeConversationId,
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
        addMessage,
        upsertConversationFromMessage,
        hoistConversation,
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
        addMessage: state.addMessage,
        upsertConversationFromMessage: state.upsertConversationFromMessage,
        hoistConversation: state.hoistConversation,
        setTyping: state.setTyping,
        clearTyping: state.clearTyping,
        updateMessageReactions: state.updateMessageReactions,
        updatePollData: state.updatePollData,
        addReadReceipt: state.addReadReceipt,
        updateMessagePinStatus: state.updateMessagePinStatus,
        addMessageAttachment: state.addMessageAttachment
    })));

    const { user, token } = useAuthStore(useShallow(state => ({
        user: state.user,
        token: state.token
    })));
    const blockedUserIds = useFriendStore(state => state.blockedUserIds);
    const isInitialized = useMessengerStore(state => state.isInitialized);

    useEffect(() => {
        if (!loading && token && !isInitialized) {
            void initMessenger();
        }
    }, [initMessenger, loading, token, isInitialized]);

    useEffect(() => {
        if (!activeConversationId || !user) return;

        const isConversationKnown = useMessengerStore.getState().conversations.some(
            (conversation) => conversation.conversationId === activeConversationId,
        );
        if (!isConversationKnown) {
            void getConversationById(activeConversationId)
                .then((conversation) => {
                    hoistConversation(conversation);
                })
                .catch((error) => {
                    logger.debug('[useMessengerSetup] Failed to refresh active conversation before subscribe', error);
                });
        }

        logger.debug(`[useMessengerSetup] Subscribing to conversation: ${activeConversationId}`);

        const unsubMessage = realtimeService.subscribe(`/topic/conversation/${activeConversationId}`, (raw: BackendMessage) => {
            const msg = mapToMessage(raw);
            if (!msg.messageId || !msg.sender?.userId) return;

            if (blockedUserIds.has(String(msg.sender.userId))) {
                logger.debug(`[useMessengerSetup] Ignoring message from blocked user: ${msg.sender.userId}`);
                return;
            }

            addMessage(activeConversationId, msg);
            upsertConversationFromMessage(msg);
            if (msg.sender.userId !== user.userId && !msg.isDeleted) {
                void markMessagesAsRead(activeConversationId, [msg]);
            }
        });

        const typingTopic = `/topic/conversation/${activeConversationId}/typing`;
        const unsubTyping = realtimeService.subscribe(typingTopic, (event: TypingEvent) => {
            if (event.conversationId !== activeConversationId || event.user.userId === user.userId) return;

            if (blockedUserIds.has(event.user.userId)) {
                return;
            }

            setTyping(event);
        });

        const unsubReactions = realtimeService.subscribe(
            `/topic/conversation/${activeConversationId}/reactions`,
            (event: { messageId: string; emoji: string; userId: string; action: 'ADD' | 'REMOVE' }) => {
                if (blockedUserIds.has(String(event.userId))) return;
                updateMessageReactions(activeConversationId, event.messageId, event);
            }
        );

        const unsubReadReceipts = realtimeService.subscribe(
            `/topic/conversation/${activeConversationId}/read`,
            (event: { messageId: string; readerId: string; readAt: string }) => {
                if (blockedUserIds.has(String(event.readerId))) return;
                addReadReceipt(activeConversationId, event.messageId, {
                    readerId: event.readerId,
                    readAt: event.readAt,
                });
            }
        );

        const unsubPolls = realtimeService.subscribe(
            `/topic/conversation/${activeConversationId}/polls`,
            (pollData: Message['poll']) => {
                if (pollData?.createdBy && blockedUserIds.has(String(pollData.createdBy))) return;
                updatePollData(activeConversationId, pollData);
            }
        );

        const unsubPins = realtimeService.subscribe(
            `/topic/conversation/${activeConversationId}/pins`,
            (event: { messageId: string; action: 'PIN' | 'UNPIN'; pinnedBy: string }) => {
                if (blockedUserIds.has(String(event.pinnedBy))) return;
                updateMessagePinStatus(activeConversationId, event.messageId, event.action === 'PIN');
            }
        );

        const unsubAttachments = realtimeService.subscribe(
            `/topic/conversation/${activeConversationId}/attachments`,
            (event: { messageId: string; attachment: NonNullable<Message['attachments']>[number]; addedBy: string }) => {
                if (blockedUserIds.has(String(event.addedBy))) return;
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
        hoistConversation,
        setTyping,
        updateMessageReactions,
        updatePollData,
        upsertConversationFromMessage,
        clearTyping,
        addReadReceipt,
        updateMessagePinStatus,
        addMessageAttachment,
        blockedUserIds
    ]);
};


