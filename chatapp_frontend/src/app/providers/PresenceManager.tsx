import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { usePresenceStore } from '@/features/presence/model/presence.store';
import { presenceWsService } from '@/features/presence/services/presenceWsService';
import { presenceTracker } from '@/features/presence/services/presenceTracker';
import { addConnectionListener, isWebSocketReady } from '@/shared/websocket/websocketService';
import { logger } from '@/shared/lib/logger';
import { notifyError } from '@/shared/lib/notification';
import { localizeText } from '@/shared/i18n';

export function PresenceManager(): null {
    const isAuthenticated = useAuthStore((state) => !!state.user && !!state.token);
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
            if (!isAuthenticatedRef.current || !isWebSocketReady()) return;
            logger.debug('[PresenceManager] Debounced resync');
            presenceTracker.resync();
        }, 300);
    }, []);

    const initializePresenceConnections = useCallback(() => {
        if (!presenceSubscriptionsReady.current) {
            presenceWsService.subscribeToPresenceEvents();
            presenceWsService.subscribeToPresenceBatch((events) => {
                for (const event of events) usePresenceStore.getState().updateOnlineStatus(event);
            });
            presenceWsService.subscribeToPresenceSync(
                (status, requestId, traceId) => {
                    logger.info('[PresenceManager] Status synced', { status, requestId, traceId });
                    usePresenceStore.getState().setMyStatusFromServer(status, requestId, traceId);
                },
                (errorType, message, requestId, traceId) => {
                    logger.warn('[PresenceManager] Status sync error', {
                        errorType: errorType.slice(0, 64),
                        hasRequestId: Boolean(requestId),
                        hasTraceId: Boolean(traceId),
                    });
                    const didRollback = usePresenceStore.getState().rollbackMyStatus(requestId, traceId);
                    if (didRollback) notifyError(localizeText('Không thể cập nhật trạng thái hoạt động. Vui lòng thử lại.'));
                },
            );
            presenceSubscriptionsReady.current = true;
        }

        presenceWsService.sendHeartbeat();
        presenceWsService.startHeartbeat(30000);
        presenceTracker.resync();

        if (delayedResyncRef.current) clearTimeout(delayedResyncRef.current);
        delayedResyncRef.current = setTimeout(() => {
            if (isAuthenticatedRef.current && isWebSocketReady()) {
                logger.debug('[PresenceManager] Delayed resync');
                presenceTracker.resync();
            }
        }, 600);
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;
        const unsubscribeConnection = addConnectionListener(() => {
            if (isAuthenticatedRef.current) initializePresenceConnections();
        });

        return () => {
            if (delayedResyncRef.current) clearTimeout(delayedResyncRef.current);
            if (resyncDebounceRef.current) clearTimeout(resyncDebounceRef.current);
            unsubscribeConnection();
            presenceWsService.shutdownPresenceSystem();
            presenceSubscriptionsReady.current = false;
        };
    }, [isAuthenticated, initializePresenceConnections]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const handleFocus = () => {
            presenceWsService.sendHeartbeat();
            debouncedResync();
        };
        const handleVisibilityChange = () => {
            if (!document.hidden) debouncedResync();
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
        if (delayedResyncRef.current) clearTimeout(delayedResyncRef.current);
        if (resyncDebounceRef.current) clearTimeout(resyncDebounceRef.current);
        presenceWsService.stopHeartbeat();
    }, [isAuthenticated]);

    return null;
}

export default PresenceManager;
