import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useMessengerStore } from '../store/messengerStore';
import { usePresenceStore } from '../store/presenceStore';
import { presenceWsService } from '../services/ws/presenceWsService';
import { presenceTracker } from '../services/ws/presenceTracker';
import { addConnectionListener, isWebSocketReady } from '../services/websocketService';
import { logger } from '../utils/logger';

/**
 * Collect all DM partner user IDs from the messenger store.
 * Used to subscribe to presence independently of component lifecycle.
 */
function getConversationPartnerIds(): string[] {
  const conversations = useMessengerStore.getState().conversations;
  const ids = new Set<string>();
  for (const conv of conversations) {
    if (conv.type === 'dm' && conv.otherParticipant?.userId) {
      ids.add(conv.otherParticipant.userId);
    }
  }
  return Array.from(ids);
}

/**
 * Subscribe to presence for all known conversation partners.
 * This is the safety-net path — works even when useTrackPresence
 * hooks haven't mounted or presenceTracker refCounts are empty.
 */
function subscribeConversationPartners(): void {
  const partnerIds = getConversationPartnerIds();
  if (partnerIds.length === 0) return;

  logger.info('[PresenceManager] Subscribing to', partnerIds.length, 'conversation partners');
  presenceWsService.subscribeToUserPresence(partnerIds);
  presenceWsService.requestBatchPresence(partnerIds);
}

/**
 * PresenceManager — invisible lifecycle component.
 * Mount once in App.tsx. Handles:
 *  - WS connect/reconnect → subscribe queues, start heartbeat, resync tracker
 *  - Conversations change → re-subscribe partners
 *  - Window focus / visibility → resync tracker (debounced)
 *  - beforeunload → stop heartbeat (no STOMP messages during unload)
 *  - Logout → clear tracker
 */
export function PresenceManager(): null {
  const isAuthenticated = useAuthStore(state => !!state.user && !!state.token);
  const conversations = useMessengerStore(state => state.conversations);

  // Refs to avoid stale closures in event handlers and timers
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  const delayedResyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resyncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Debounced resync: collapses rapid focus+visibility events into one call */
  const debouncedResync = useCallback(() => {
    if (resyncDebounceRef.current) clearTimeout(resyncDebounceRef.current);
    resyncDebounceRef.current = setTimeout(() => {
      resyncDebounceRef.current = null;
      if (!isAuthenticatedRef.current) return;
      if (!isWebSocketReady()) return;
      logger.debug('[PresenceManager] Debounced resync');
      presenceTracker.resync();
      subscribeConversationPartners();
    }, 300);
  }, []);

  // --- WS connect / reconnect ---
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = addConnectionListener(() => {
      // Guard: user may have logged out between reconnect attempts
      if (!isAuthenticatedRef.current) return;

      logger.info('[PresenceManager] WS connected — initializing presence');
      // 1. Subscribe to presence push + batch queues (always replaces stale subs)
      presenceWsService.subscribeToPresenceEvents();
      // 2. Subscribe to multi-device status sync queue
      presenceWsService.subscribeToPresenceSync(
        // onStatusSync: another device changed status → update this device too
        (status) => {
          const { setMyStatus } = usePresenceStore.getState();
          setMyStatus(status as 'ONLINE' | 'DND' | 'INVISIBLE');
          logger.info('[PresenceManager] Status synced from another device:', status);
        },
        // onRateLimit: too many changes from THIS device → revert to last known server status
        (_retryAfterSeconds) => {
          logger.warn('[PresenceManager] Status change rate limited, reverting to ONLINE');
          // Revert to ONLINE as safe default — server has rejected the change
          const { setMyStatus } = usePresenceStore.getState();
          setMyStatus('ONLINE');
        }
      );
      // 3. Start heartbeat (30s, server TTL 45s)
      presenceWsService.startHeartbeat(30000);
      // 4. Re-sync watched users with backend (handles reconnect)
      presenceTracker.resync();
      // 5. Direct subscribe to all conversation partners from the store.
      //    This handles the case where presenceTracker refCounts are empty
      //    (e.g., components haven't mounted yet due to a loading screen).
      subscribeConversationPartners();
      if (delayedResyncRef.current) clearTimeout(delayedResyncRef.current);
      delayedResyncRef.current = setTimeout(() => {
        delayedResyncRef.current = null;
        if (!isAuthenticatedRef.current) return;
        if (!isWebSocketReady()) return;
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

  // --- Re-subscribe when conversations change ---
  // When initMessenger finishes loading and populates conversations,
  // or when a new conversation is hoisted, re-subscribe presence.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!isWebSocketReady()) return;

    // Conversations just changed — make sure we're watching all partners
    subscribeConversationPartners();
  }, [isAuthenticated, conversations]);

  // --- Window focus / visibility ---
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleFocus = () => {
      debouncedResync();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        debouncedResync();
      }
    };

    // On beforeunload: ONLY stop heartbeat. Do NOT send STOMP messages
    // during page unload — they are unreliable and can race with the new
    // page's subscriptions. The server's handleDisconnect will clean up.
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
  }, [isAuthenticated, debouncedResync]);

  // --- Logout cleanup ---
  useEffect(() => {
    if (!isAuthenticated) {
      presenceTracker.clear();
      // Clear any pending timers to prevent stale operations after logout
      if (delayedResyncRef.current) {
        clearTimeout(delayedResyncRef.current);
        delayedResyncRef.current = null;
      }
      if (resyncDebounceRef.current) {
        clearTimeout(resyncDebounceRef.current);
        resyncDebounceRef.current = null;
      }
    }
  }, [isAuthenticated]);

  return null;
}

export default PresenceManager;
