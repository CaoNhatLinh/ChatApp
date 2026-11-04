import { useCallback, useEffect, useRef } from 'react';
import { isAxiosError } from 'axios';
import { prepareMessageSend, completeMessageSend } from './messageSendAttempt';
import { loadConversationEntry } from './conversation-entry';
import { getSessionGeneration, SessionChangedError } from '@/shared/auth/access-token';
import { useShallow } from 'zustand/react/shallow';
import { useMessengerStore, EMPTY_TYPING } from '@/features/messenger/model/messenger.store';
import { realtimeService } from '@/shared/websocket/realtime-service';
import {
    getConversations,
    getConversationById,
    getMessages,
    mapMessagePinState,
    sendMessageHttp,
    editMessage as editMessageApi,
    deleteMessage as deleteMessageApi,
    getMessageRevisions as getMessageRevisionsApi,
    getMessageReadReceipts as getMessageReadReceiptsApi,
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
    MessageReadReceiptPage,
    SendMessageRequest,
    MessageSendOptions,
    MessageType,
    TypingEvent
} from '../types/messenger.types';
import type { ConversationSlice, MessageSlice } from './messenger.store.types';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { logger } from '@/shared/lib/logger';
import { notifyError } from '@/shared/lib/notification';
import { localizeText } from '@/shared/i18n';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { mapCanonicalPollAggregate } from '../api/poll.api';

const MESSAGES_TTL_MS = 60_000;
const CONVERSATION_PAGE_SIZE = 30;
const INITIAL_MESSAGES_PAGE_SIZE = 30;
const LOAD_MORE_MESSAGES_PAGE_SIZE = 20;
const initTracker = { key: '', promise: null as Promise<void> | null };
const initMessengerSubscriptions = new Map<string, Array<() => void>>();

const isHistoryAccessDenied = (error: unknown): boolean => {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    return status === 403 || status === 404;
};

const clearInitSubscriptions = (key: string): void => {
    const unsubscribers = initMessengerSubscriptions.get(key) || [];
    unsubscribers.forEach((unsubscribe) => {
        try {
            unsubscribe();
        } catch (error) {
            logger.debug('[useMessenger] Failed to unsubscribe previous init subscription', error instanceof Error ? error.message : String(error));
        }
    });
    initMessengerSubscriptions.delete(key);
};

interface UseMessengerResult {
    initMessenger: () => Promise<void>;
    selectConversation: (conversationId: string | null) => Promise<void>;
    loadInitialMessages: (conversationId: string) => Promise<void>;
    loadMoreMessages: (conversationId: string) => Promise<boolean>;
    loadMoreConversations: () => Promise<void>;
    sendMessage: (content: string, type?: MessageType, options?: MessageSendOptions) => Promise<void>;
    editMessage: (messageId: string, content: string) => Promise<Message | null>;
    deleteMessage: (messageId: string) => Promise<Message | null>;
    loadMessageRevisions: (messageId: string) => Promise<MessageRevision[]>;
    loadMessageReadReceipts: (messageId: string, cursor?: string | null) => Promise<MessageReadReceiptPage>;
    pinMessage: (messageId: string) => Promise<void>;
    uploadMessageFiles: (files: File[], signal?: AbortSignal, uploadIds?: readonly string[]) => Promise<SendMessageRequest['attachments']>;
    sendTyping: (isTyping: boolean) => void;
    loading: boolean;
    error: string | null;
    isSidebarOpen: boolean;
    conversations: Conversation[];
    conversationsPagination: { hasNext: boolean; nextCursor: string | null; loading: boolean };
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
        appendConversations,
        setConversationsLoading,
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
        updateMessage
    } = useMessengerStore(useShallow(state => ({
        setActiveView: state.setActiveView,
        setConversations: state.setConversations,
        appendConversations: state.appendConversations,
        setConversationsLoading: state.setConversationsLoading,
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
        updateMessage: state.updateMessage
    })));

    const {
        activeView,
        activeConversationId,
        loading,
        error,
        isSidebarOpen,
        conversations,
        conversationsPagination,
        messagesPagination,
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
        conversationsPagination: state.conversationsPagination,
        messagesPagination: state.messagesPagination,
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
    const loadMoreConversationsInFlightRef = useRef(false);

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
            logger.debug('Failed to refresh conversation summary', err instanceof Error ? err.message : String(err));
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
                    getConversations(CONVERSATION_PAGE_SIZE),
                    user?.userId ? getReceivedRequests(100) : Promise.resolve<FriendshipStatusResponse | null>(null)
                ]);

                setConversations(convResponse.content, {
                    hasNext: convResponse.hasNext,
                    nextCursor: convResponse.nextCursor,
                });

                if (requestResponse) {
                    setFriendRequestCount(requestResponse.userDetails.length);
                }

                if (!realtimeService.isConnected()) {
                    void realtimeService.connect(token).catch((error: unknown) => {
                        logger.warn(
                            '[useMessenger] Realtime connection is unavailable; continuing with HTTP data',
                            String(error),
                        );
                    });
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
                const errorMessage = getUserFacingErrorMessage(err, MESSENGER_COPY.errors.loadConversationsFailed);
                clearInitSubscriptions(initKey);
                setError(errorMessage);
                logger.error('[useMessenger] Error initializing messenger:', err instanceof Error ? err.message : String(err));
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

    const loadInitialMessages = useCallback(async (conversationId: string) => {
        const store = useMessengerStore.getState();
        if (store.activeConversationId !== conversationId || store.initialMessageHistory?.status === 'loading') return;
        const cachedMessages = store.messages[conversationId];
        const fetchedAt = store.messagesPagination[conversationId]?.fetchedAt;
        if (!store.unavailableMessageHistory[conversationId] && store.initialMessageHistory?.status !== 'error'
            && cachedMessages?.length && fetchedAt && Date.now() - fetchedAt <= MESSAGES_TTL_MS) {
            return;
        }

        const requestId = crypto.randomUUID();
        const generation = getSessionGeneration();
        const isCurrent = () => {
            const current = useMessengerStore.getState();
            return generation === getSessionGeneration() && current.activeConversationId === conversationId
                && current.initialMessageHistory?.requestId === requestId;
        };
        store.setInitialMessageHistory({ conversationId, requestId, status: 'loading' });
        store.setOlderMessageHistory(null);
        try {
            const response = await getMessages(conversationId, { page: 0, size: INITIAL_MESSAGES_PAGE_SIZE });
            if (!isCurrent()) return;
            setMessages(conversationId, response.content, {
                before: cachedMessages ?? [],
                hasNext: response.hasNext,
                page: response.number,
                nextCursor: response.nextCursor,
            });
            if (isCurrent()) {
                store.setMessageHistoryUnavailable(conversationId, false);
                store.setInitialMessageHistory(null);
            }
        } catch (err: unknown) {
            if (!isCurrent()) return;
            if (isHistoryAccessDenied(err)) store.setMessageHistoryUnavailable(conversationId, true);
            store.setInitialMessageHistory({ conversationId, requestId, status: 'error' });
            logger.debug('[useMessenger] Error loading initial messages:', err instanceof Error ? err.message : String(err));
        }
    }, [setMessages]);

    const selectConversation = useCallback(async (conversationId: string | null) => {
        setActiveConversation(conversationId);
        if (!conversationId) return;
        const generation = getSessionGeneration();
        const known = useMessengerStore.getState().conversations.some(
            conversation => conversation.conversationId === conversationId,
        );
        if (!known && !await loadConversationEntry(conversationId)) return;
        if (generation === getSessionGeneration()) await loadInitialMessages(conversationId);
    }, [setActiveConversation, loadInitialMessages]);

    const olderPageRequest = useRef<{ requestId: string; result: Promise<boolean> } | null>(null);
    const loadMoreMessages = useCallback(async (conversationId: string) => {
        const state = useMessengerStore.getState();
        const pagination = state.messagesPagination[conversationId];
        if (!pagination?.hasNext || state.loading || state.activeConversationId !== conversationId
            || state.unavailableMessageHistory[conversationId]
            || state.initialMessageHistory?.status === 'loading') return false;
        if (state.olderMessageHistory?.status === 'loading') {
            const pending = olderPageRequest.current;
            return pending?.requestId === state.olderMessageHistory.requestId ? pending.result : false;
        }
        const requestId = crypto.randomUUID();
        const generation = getSessionGeneration();
        const ownsPage = () => {
            const current = useMessengerStore.getState();
            return generation === getSessionGeneration() && current.activeConversationId === conversationId
                && current.messagesPagination[conversationId] === pagination
                && current.olderMessageHistory?.requestId === requestId
                && !current.unavailableMessageHistory[conversationId]
                && current.initialMessageHistory?.status !== 'loading';
        };

        state.setOlderMessageHistory({ conversationId, requestId, status: 'loading' });

        const result = (async () => {
            try {
                const response = await getMessages(conversationId, {
                    page: pagination.page + 1,
                    size: LOAD_MORE_MESSAGES_PAGE_SIZE,
                    before: pagination.nextCursor,
                });
                if (!ownsPage()) return false;
                prependMessages(conversationId, response.content, { before: state.messages[conversationId] ?? [],
                    hasNext: response.hasNext, page: response.number, nextCursor: response.nextCursor });
                state.setOlderMessageHistory(null);
                return true;
            } catch (err: unknown) {
                if (!ownsPage()) return false;
                if (isHistoryAccessDenied(err)) {
                    state.setMessageHistoryUnavailable(conversationId, true);
                    state.setInitialMessageHistory({ conversationId, requestId, status: 'error' });
                    state.setOlderMessageHistory(null);
                    return false;
                }
                state.setOlderMessageHistory({ conversationId, requestId, status: 'error' });
                logger.debug('[useMessenger] Error loading more messages', err instanceof Error ? err.message : String(err));
                return false;
            } finally {
                if (olderPageRequest.current?.requestId === requestId) olderPageRequest.current = null;
            }
        })();
        olderPageRequest.current = { requestId, result };
        return result;
    }, [prependMessages]);

    const loadMoreConversations = useCallback(async () => {
        if (loadMoreConversationsInFlightRef.current) return;
        const pagination = useMessengerStore.getState().conversationsPagination;
        if (!pagination.hasNext || pagination.loading || !pagination.nextCursor) return;

        loadMoreConversationsInFlightRef.current = true;
        setConversationsLoading(true);
        try {
            const page = await getConversations(CONVERSATION_PAGE_SIZE, pagination.nextCursor);
            appendConversations(page.content, {
                hasNext: page.hasNext,
                nextCursor: page.nextCursor,
            });
        } catch (err: unknown) {
            setConversationsLoading(false);
            logger.error('[useMessenger] Error loading more conversations', err instanceof Error ? err.message : String(err));
            notifyError(getUserFacingErrorMessage(err, localizeText('Không thể tải thêm cuộc trò chuyện.')));
        } finally {
            loadMoreConversationsInFlightRef.current = false;
        }
    }, [appendConversations, setConversationsLoading]);

    const sendMessage = useCallback(async (
        content: string,
        type: MessageType = 'TEXT',
        options?: MessageSendOptions
    ) => {
        const trimmedContent = content.trim();
        const hasSticker = type === 'STICKER' && Boolean(options?.stickerId);
        const hasGif = type === 'GIF' && options?.gif?.provider === 'GIPHY' && Boolean(options.gif.providerGifId);
        if (!activeConversationId || !user || (!trimmedContent && !hasSticker && !hasGif && (!options?.attachments || options.attachments.length === 0))) return;

        const generation = getSessionGeneration();
        const payload: Omit<SendMessageRequest, 'clientMessageId'> = {
            conversationId: activeConversationId,
            content: trimmedContent,
            type,
            stickerId: options?.stickerId,
            gif: options?.gif ? { ...options.gif } : undefined,
            replyToId: options?.replyToId,
            replyToMessageBucket: options?.replyToMessageBucket,
            mentions: options?.mentions ? [...options.mentions] : undefined,
            mentionEveryone: options?.mentionEveryone,
            attachments: options?.attachments?.map(attachment => ({ ...attachment }))
        };
        const clientMessageId = options?.clientMessageId ?? await prepareMessageSend(user.userId, payload);
        if (generation !== getSessionGeneration()) throw new SessionChangedError();
        const request: SendMessageRequest = { ...payload, clientMessageId };
        options?.onPrepared?.(request);

        const tempId = `temp-${clientMessageId}`;
        const tempMessage: Message = {
            messageId: tempId,
            clientMessageId,
            pendingSend: request,
            pendingUploadIds: options?.uploadIds ? [...options.uploadIds] : undefined,
            conversationId: activeConversationId,
            sender: user,
            content,
            type,
            stickerId: request.stickerId,
            gif: request.gif ? { ...request.gif } : undefined,
            attachments: request.attachments?.map(attachment => ({ ...attachment })) ?? [],
            replyTo: request.replyToId && request.replyToMessageBucket ? {
                messageId: request.replyToId,
                messageBucket: request.replyToMessageBucket,
            } : undefined,
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
            const confirmed = await sendMessageHttp(request);
            if (generation !== getSessionGeneration()) throw new SessionChangedError();
            const delivered: Message = {
                ...confirmed,
                pendingSend: undefined,
                attachments: confirmed.attachments?.length ? confirmed.attachments : tempMessage.attachments,
                status: 'sent',
            };
            addMessage(activeConversationId, delivered);
            upsertConversationFromMessage(delivered);
            completeMessageSend(user.userId, activeConversationId, clientMessageId);
        } catch (err: unknown) {
            if (generation !== getSessionGeneration()) throw new SessionChangedError();
            logger.error('[useMessenger] Error sending message', err instanceof Error ? err.message : String(err));
            const status = isAxiosError(err) ? err.response?.status : undefined;
            const retryNeedsAttachmentCheck = Boolean(request.attachments?.length) && (status === 403 || status === 409);
            updateMessageStatus(activeConversationId, tempId, 'failed', { retryNeedsAttachmentCheck });
            throw err;
        }
    }, [activeConversationId, user, addMessage, upsertConversationFromMessage, updateMessageStatus]);

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

    const loadMessageReadReceipts = useCallback(async (
        messageId: string,
        cursor?: string | null,
    ): Promise<MessageReadReceiptPage> => {
        if (!activeConversationId) return { content: [], nextCursor: null, hasNext: false };
        const messageBucket = useMessengerStore.getState().messages[activeConversationId]
            ?.find((message) => message.messageId === messageId)?.messageBucket;
        if (!messageBucket) throw new Error('Message bucket is required');
        return getMessageReadReceiptsApi(activeConversationId, messageBucket, messageId, { cursor });
    }, [activeConversationId]);

    const pinMessage = useCallback(async (messageId: string) => {
        if (!activeConversationId) return;
        const message = useMessengerStore.getState().messages[activeConversationId]
            ?.find((candidate) => candidate.messageId === messageId);
        const messageBucket = message?.messageBucket;
        if (!messageBucket) throw new Error('Message bucket is required');
        const pinState = useMessengerStore.getState().messagePinStates[activeConversationId];
        if (!pinState) throw new Error(MESSENGER_COPY.errors.pinStateUnavailable);
        const updated = await pinMessageApi(
            activeConversationId, messageBucket, messageId, !message.isPinned, pinState.revision,
        );
        updateMessage(activeConversationId, updated.message);
        useMessengerStore.getState().applyMessagePinState(updated.pinState);
    }, [activeConversationId, updateMessage]);

    const uploadMessageFiles = useCallback(async (files: File[], signal?: AbortSignal, uploadIds?: readonly string[]) => {
        return uploadFiles(files, signal, uploadIds, 'COMPOSER');
    }, []);

    const sendTyping = useCallback((isTyping: boolean) => {
        if (!activeConversationId || !user) return;
        realtimeService.publish(`/app/typing`, {
            conversationId: activeConversationId,
            isTyping
        });
    }, [activeConversationId, user]);

    const pinConversation = useCallback(async (conversationId: string) => {
        const generation = getSessionGeneration();
        try {
            await pinConversationApi(conversationId);
            if (generation !== getSessionGeneration()) throw new SessionChangedError();
            pinConversationStore(conversationId);
        } catch (err: unknown) {
            if (!(err instanceof SessionChangedError)) {
                logger.error('[useMessenger] Error pinning conversation', err instanceof Error ? err.message : String(err));
            }
            throw err;
        }
    }, [pinConversationStore]);

    const unpinConversation = useCallback(async (conversationId: string) => {
        const generation = getSessionGeneration();
        try {
            await unpinConversationApi(conversationId);
            if (generation !== getSessionGeneration()) throw new SessionChangedError();
            unpinConversationStore(conversationId);
        } catch (err: unknown) {
            if (!(err instanceof SessionChangedError)) {
                logger.error('[useMessenger] Error unpinning conversation', err instanceof Error ? err.message : String(err));
            }
            throw err;
        }
    }, [unpinConversationStore]);

    return {
        initMessenger,
        selectConversation,
        loadInitialMessages,
        loadMoreMessages,
        loadMoreConversations,
        sendMessage,
        editMessage,
        deleteMessage,
        loadMessageRevisions,
        loadMessageReadReceipts,
        pinMessage,
        uploadMessageFiles,
        sendTyping,
        loading,
        error,
        isSidebarOpen,
        conversations,
        conversationsPagination,
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
        applyMessagePinState
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
        applyMessagePinState: state.applyMessagePinState
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
                .catch((error: unknown) => {
                    logger.debug('[useMessengerSetup] Failed to refresh active conversation before subscribe', error instanceof Error ? error.message : String(error));
                });
        }

        logger.debug(`[useMessengerSetup] Subscribing to conversation: ${activeConversationId}`);

        const unsubMessage = realtimeService.subscribe(`/topic/conversation/${activeConversationId}`, (raw: BackendMessage) => {
            if (raw.conversationId !== activeConversationId) return;
            const msg = mapToMessage(raw);
            if (!msg.messageId || !msg.sender?.userId) return;

            if (blockedUserIds.has(String(msg.sender.userId))) {
                logger.debug(`[useMessengerSetup] Ignoring message from blocked user: ${msg.sender.userId}`);
                return;
            }

            addMessage(activeConversationId, msg);
            upsertConversationFromMessage(msg);
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
            (payload: unknown) => {
                const pollData = mapCanonicalPollAggregate(payload);
                if (pollData?.createdBy && blockedUserIds.has(String(pollData.createdBy))) return;
                updatePollData(activeConversationId, pollData);
            }
        );

        const unsubPins = realtimeService.subscribe(
            `/topic/conversation/${activeConversationId}/pins`,
            (payload: unknown) => applyMessagePinState(mapMessagePinState(payload, activeConversationId))
        );

        return () => {
            logger.debug(`[useMessengerSetup] Unsubscribing from conversation: ${activeConversationId}`);
            unsubMessage();
            unsubTyping();
            unsubReactions();
            unsubReadReceipts();
            unsubPolls();
            unsubPins();
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
        applyMessagePinState,
        blockedUserIds
    ]);
};


