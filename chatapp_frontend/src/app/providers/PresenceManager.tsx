import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useMessengerStore } from '@/features/messenger/model/messenger.store';
import { usePresenceStore } from '@/features/presence/model/presence.store';
import { presenceWsService } from '@/features/presence/services/presenceWsService';
import { presenceTracker } from '@/features/presence/services/presenceTracker';
import { addConnectionListener, isWebSocketReady } from '@/shared/websocket/websocketService';
import { logger } from '@/shared/lib/logger';
import { notifyError } from '@/shared/lib/notification';

const RATE_LIMIT_RETRY_FLOOR_SECONDS = 1;

function subscribeConversationPartners(partnerIds: string[]): void {
    logger.info('[PresenceManager] Syncing', partnerIds.length, 'conversation partners');
    presenceTracker.replaceManaged(partnerIds);
}

function safeNumber(value: unknown, fallback = 0): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

export function PresenceManager(): null {
    const isAuthenticated = useAuthStore((state) => !!state.user && !!state.token);
    const conversationPartnerIdsKey = useMessengerStore(
        useShallow((state) => {
            const partnerIds = new Set<string>();

            for (const conversation of state.conversations) {
                if (conversation.type === 'dm' && conversation.otherParticipant?.userId) {
                    partnerIds.add(conversation.otherParticipant.userId);
                }
            }

            return Array.from(partnerIds).sort().join(',');
        })
    );
    const conversationPartnerIds = useMemo(
        () => conversationPartnerIdsKey.split(',').filter(Boolean),
        [conversationPartnerIdsKey],
    );

    const isAuthenticatedRef = useRef(isAuthenticated);
    isAuthenticatedRef.current = isAuthenticated;

    const presenceSubscriptionsReady = useRef(false);
    const delayedResyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resyncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const debouncedResync = useCallback(() => {
        if (resyncDebounceRef.current) {
            clearTimeout(resyncDebounceRef.current);
        }

        resyncDebounceRef.current = setTimeout(() => {
            resyncDebounceRef.current = null;
            if (!isAuthenticatedRef.current || !isWebSocketReady()) {
                return;
            }

            logger.debug('[PresenceManager] Debounced resync');
            presenceTracker.resync();
            subscribeConversationPartners(conversationPartnerIds);
        }, 300);
    }, [conversationPartnerIds]);

    const initializePresenceConnections = useCallback(() => {
        if (!presenceSubscriptionsReady.current) {
            presenceWsService.subscribeToPresenceEvents();
            presenceWsService.subscribeToPresenceBatch((events) => {
                for (const event of events) {
                    usePresenceStore.getState().updateOnlineStatus(event);
                }
            });

            presenceWsService.subscribeToPresenceSync(
                (status, requestId, traceId) => {
                    logger.info('[PresenceManager] Status synced', { status, requestId, traceId });
                    usePresenceStore.getState().setMyStatusFromServer(status, requestId, traceId);
                },
                (retryAfterSeconds, requestId, traceId) => {
                    logger.warn('[PresenceManager] Status change rate limited', {
                        retryAfterSeconds,
                        requestId,
                        traceId,
                    });

                    const requestedStatus = usePresenceStore.getState().pendingStatusDesired;
                    const didRollback = usePresenceStore.getState().rollbackMyStatus(requestId, traceId);
                    if (didRollback) {
                        const retryDelaySeconds = Math.max(
                            RATE_LIMIT_RETRY_FLOOR_SECONDS,
                            safeNumber(retryAfterSeconds, RATE_LIMIT_RETRY_FLOOR_SECONDS)
                        );
                        notifyError(`Status update was rate limited. Retrying in ${retryDelaySeconds} seconds.`);
                        setTimeout(() => {
                            const latest = usePresenceStore.getState();
                            if (latest.isUpdatingMyStatus) {
                                return;
                            }

                            if (!requestedStatus || latest.myStatus !== requestedStatus) {
                                return;
                            }

                            const statusChange = presenceWsService.setStatus(requestedStatus);
                            usePresenceStore.getState().setMyStatus(requestedStatus, statusChange.requestId, statusChange.traceId);
                            logger.info('[PresenceManager] Retrying status sync', {
                                status: requestedStatus,
                                requestId: statusChange.requestId,
                                traceId: statusChange.traceId,
                            });
                        }, retryDelaySeconds * 1000);
                    }
                },
                (errorType, message, requestId, traceId) => {
                    logger.warn('[PresenceManager] Status sync error', {
                        errorType,
                        message,
                        requestId,
                        traceId,
                    });
                    const didRollback = usePresenceStore.getState().rollbackMyStatus(requestId, traceId);
                    if (didRollback) {
                        notifyError(`${errorType}: ${message}`);
                    }
                }
            );

            presenceSubscriptionsReady.current = true;
        }

        presenceWsService.sendHeartbeat();
        presenceWsService.startHeartbeat(30000);
        presenceTracker.resync();
        subscribeConversationPartners(conversationPartnerIds);

        if (delayedResyncRef.current) {
            clearTimeout(delayedResyncRef.current);
            delayedResyncRef.current = null;
        }

        delayedResyncRef.current = setTimeout(() => {
            if (!isAuthenticatedRef.current || !isWebSocketReady()) {
                return;
            }
            logger.debug('[PresenceManager] Delayed resync');
            presenceTracker.resync();
            subscribeConversationPartners(conversationPartnerIds);
        }, 600);
    }, [conversationPartnerIds]);

    useEffect(() => {
        if (!isAuthenticated) return;

        const unsubscribeConnection = addConnectionListener(() => {
            if (!isAuthenticatedRef.current) return;

            initializePresenceConnections();
        });

        return () => {
            if (delayedResyncRef.current) {
                clearTimeout(delayedResyncRef.current);
                delayedResyncRef.current = null;
            }
            if (resyncDebounceRef.current) {
                clearTimeout(resyncDebounceRef.current);
                resyncDebounceRef.current = null;
            }

            unsubscribeConnection();
            presenceWsService.shutdownPresenceSystem();
            presenceSubscriptionsReady.current = false;
        };
    }, [isAuthenticated, initializePresenceConnections]);

    useEffect(() => {
        if (!isAuthenticated || !isWebSocketReady()) return;
        subscribeConversationPartners(conversationPartnerIds);
    }, [isAuthenticated, conversationPartnerIds]);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        const handleFocus = () => {
            presenceWsService.sendHeartbeat();
            debouncedResync();
        };

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                debouncedResync();
            }
        };

        const handleBeforeUnload = () => {
            presenceWsService.stopHeartbeat();
            usePresenceStore.getState().clearPresences();
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [debouncedResync, isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) return;

        presenceTracker.clear();
        usePresenceStore.getState().clearPresences();

        if (delayedResyncRef.current) {
            clearTimeout(delayedResyncRef.current);
            delayedResyncRef.current = null;
        }
        if (resyncDebounceRef.current) {
            clearTimeout(resyncDebounceRef.current);
            resyncDebounceRef.current = null;
        }
        presenceWsService.stopHeartbeat();
    }, [isAuthenticated]);

    return null;
}

export default PresenceManager;
