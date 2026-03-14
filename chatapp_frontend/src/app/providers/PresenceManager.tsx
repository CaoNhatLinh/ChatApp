import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useMessengerStore } from '@/features/messenger/model/messenger.store';
import { usePresenceStore } from '@/features/presence/model/presence.store';
import { presenceWsService } from '@/features/presence/services/presenceWsService';
import { presenceTracker } from '@/features/presence/services/presenceTracker';
import { addConnectionListener, isWebSocketReady } from '@/shared/websocket/websocketService';
import { logger } from '@/shared/lib/logger';

function getConversationPartnerIds(): string[] {
  const conversations = useMessengerStore.getState().conversations;
  const ids = new Set<string>();

  for (const conversation of conversations) {
    if (conversation.type === 'dm' && conversation.otherParticipant?.userId) {
      ids.add(conversation.otherParticipant.userId);
    }
  }

  return Array.from(ids);
}

function subscribeConversationPartners(): void {
  const partnerIds = getConversationPartnerIds();
  if (partnerIds.length === 0) {
    return;
  }

  logger.info('[PresenceManager] Subscribing to', partnerIds.length, 'conversation partners');
  presenceWsService.subscribeToUserPresence(partnerIds);
  presenceWsService.requestBatchPresence(partnerIds);
}

export function PresenceManager(): null {
  const isAuthenticated = useAuthStore((state) => !!state.user && !!state.token);
  const conversations = useMessengerStore((state) => state.conversations);

  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

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
      subscribeConversationPartners();
    }, 300);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const unsubscribe = addConnectionListener(() => {
      if (!isAuthenticatedRef.current) {
        return;
      }

      logger.info('[PresenceManager] WS connected - initializing presence');
      presenceWsService.subscribeToPresenceEvents();
      presenceWsService.subscribeToPresenceSync(
        (status) => {
          usePresenceStore.getState().setMyStatus(status as 'ONLINE' | 'DND' | 'INVISIBLE');
          logger.info('[PresenceManager] Status synced from another device:', status);
        },
        () => {
          logger.warn('[PresenceManager] Status change rate limited, reverting to ONLINE');
          usePresenceStore.getState().setMyStatus('ONLINE');
        },
      );
      presenceWsService.startHeartbeat(30000);
      presenceTracker.resync();
      subscribeConversationPartners();

      if (delayedResyncRef.current) {
        clearTimeout(delayedResyncRef.current);
      }

      delayedResyncRef.current = setTimeout(() => {
        delayedResyncRef.current = null;
        if (!isAuthenticatedRef.current || !isWebSocketReady()) {
          return;
        }

        logger.debug('[PresenceManager] Delayed resync');
        presenceTracker.resync();
        subscribeConversationPartners();
      }, 600);
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

      unsubscribe();
      presenceWsService.shutdownPresenceSystem();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !isWebSocketReady()) {
      return;
    }

    subscribeConversationPartners();
  }, [isAuthenticated, conversations]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const handleFocus = () => {
      debouncedResync();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        debouncedResync();
      }
    };

    const handleBeforeUnload = () => {
      presenceWsService.stopHeartbeat();
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
    if (isAuthenticated) {
      return;
    }

    presenceTracker.clear();
    if (delayedResyncRef.current) {
      clearTimeout(delayedResyncRef.current);
      delayedResyncRef.current = null;
    }
    if (resyncDebounceRef.current) {
      clearTimeout(resyncDebounceRef.current);
      resyncDebounceRef.current = null;
    }
  }, [isAuthenticated]);

  return null;
}

export default PresenceManager;