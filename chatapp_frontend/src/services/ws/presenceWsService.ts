// src/services/ws/presenceWsService.ts
// WebSocket presence operations: online/offline status, heartbeat, subscriptions
// Architecture: Redis-only presence, targeted push via /user/queue/presence,
// pull-on-reconnect via /app/presence.batch → /user/queue/presence-batch

import { wsConnectionManager } from './wsConnectionManager';
import { logger } from '@/utils/logger';
import { WS_DESTINATIONS } from '@/types/websocket';
import type { PresenceEvent } from '@/types/websocket';
import type { UserPresence } from '@/types/presence';
import { usePresenceStore } from '@/store/presenceStore';

class PresenceWsService {
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    // --- Custom Status ---

    /** Set custom status (ONLINE, DND, INVISIBLE) */
    setStatus(status: 'ONLINE' | 'DND' | 'INVISIBLE'): void {
        wsConnectionManager.publish(WS_DESTINATIONS.ONLINE_STATUS, JSON.stringify({ status }));
        logger.debug('[PresenceWsService] Set status:', status);
    }

    // --- Targeted Presence Subscription (from backend) ---

    /**
     * Subscribe to /user/queue/presence for targeted presence updates.
     * Backend sends updates ONLY for users we're watching (via presence.subscribe).
     * On reconnect, always replaces stale subscriptions from the dead connection.
     */
    subscribeToPresenceQueue(): void {
        if (!wsConnectionManager.stompClient?.connected) {
            logger.warn('[PresenceWsService] Cannot subscribe to presence queue - not connected');
            return;
        }

        // Remove stale subscription entry (from dead connection) without trying to unsubscribe
        // on the old (now-dead) STOMP session. Just delete the map entry so we can re-subscribe.
        if (wsConnectionManager.hasSubscription('presence_queue')) {
            wsConnectionManager.getSubscription('presence_queue'); // no-op, just checking
            // Delete the old entry directly from the map (don't call removeSubscription
            // which tries .unsubscribe() on a potentially dead StompSubscription)
            try { wsConnectionManager.removeSubscription('presence_queue'); } catch { /* ignore */ }
        }

        const subscription = wsConnectionManager.stompClient.subscribe('/user/queue/presence', (frame) => {
            try {
                const data = JSON.parse(frame.body) as PresenceEvent;
                this.handlePresenceUpdate(data);
            } catch (error) {
                logger.error('[PresenceWsService] Error parsing presence queue event:', error instanceof Error ? error.message : error);
            }
        });
        wsConnectionManager.setSubscription('presence_queue', subscription);
        logger.debug('[PresenceWsService] Subscribed to /user/queue/presence');
        logger.debug('[PresenceWsService] subscribed to /user/queue/presence');
    }

    /**
     * Subscribe to /user/queue/presence-batch for pull-on-reconnect batch responses.
     * On reconnect, always replaces stale subscriptions from the dead connection.
     */
    subscribeToPresenceBatch(): void {
        if (!wsConnectionManager.stompClient?.connected) {
            logger.warn('[PresenceWsService] Cannot subscribe to presence batch - not connected');
            return;
        }

        // Remove stale subscription entry from dead connection
        if (wsConnectionManager.hasSubscription('presence_batch')) {
            try { wsConnectionManager.removeSubscription('presence_batch'); } catch { /* ignore */ }
        }

        const subscription = wsConnectionManager.stompClient.subscribe('/user/queue/presence-batch', (frame) => {
            try {
                const data = JSON.parse(frame.body) as Record<string, UserPresence>;
                this.handleBatchPresenceResponse(data);
            } catch (error) {
                logger.error('[PresenceWsService] Error parsing presence batch:', error instanceof Error ? error.message : error);
            }
        });
        wsConnectionManager.setSubscription('presence_batch', subscription);
        logger.debug('[PresenceWsService] Subscribed to /user/queue/presence-batch');
    }

    /** Subscribe to all presence channels */
    subscribeToPresenceEvents(): void {
        logger.debug('[PresenceWsService] subscribeToPresenceEvents called');
        this.subscribeToPresenceQueue();
        this.subscribeToPresenceBatch();
    }

    /**
     * Subscribe to /user/queue/presence-sync for multi-device status sync.
     * Handles:
     *   - STATUS_SYNC: another device changed status (Last Writer Wins)
     *   - RATE_LIMIT_ERROR: too many status changes, need to revert UI
     */
    subscribeToPresenceSync(
        onStatusSync: (status: string) => void,
        onRateLimit?: (retryAfterSeconds: number) => void
    ): void {
        if (!wsConnectionManager.stompClient?.connected) {
            logger.warn('[PresenceWsService] Cannot subscribe to presence sync - not connected');
            return;
        }

        if (wsConnectionManager.hasSubscription('presence_sync')) {
            try { wsConnectionManager.removeSubscription('presence_sync'); } catch { /* ignore */ }
        }

        const subscription = wsConnectionManager.stompClient.subscribe('/user/queue/presence-sync', (frame) => {
            try {
                const data = JSON.parse(frame.body) as { type?: string; status?: string; retryAfterSeconds?: number };
                if (data.type === 'STATUS_SYNC' && data.status) {
                    logger.info('[PresenceWsService] Status sync from another device:', data.status);
                    onStatusSync(data.status);
                } else if (data.type === 'RATE_LIMIT_ERROR') {
                    logger.warn('[PresenceWsService] Rate limit exceeded, retry after:', data.retryAfterSeconds);
                    onRateLimit?.(data.retryAfterSeconds ?? 30);
                }
            } catch (error) {
                logger.error('[PresenceWsService] Error parsing presence sync:', error instanceof Error ? error.message : error);
            }
        });
        wsConnectionManager.setSubscription('presence_sync', subscription);
        logger.debug('[PresenceWsService] Subscribed to /user/queue/presence-sync');
    }

    /** Unsubscribe from all presence channels */
    unsubscribeFromPresenceEvents(): void {
        wsConnectionManager.removeSubscription('presence_queue');
        wsConnectionManager.removeSubscription('presence_batch');
        wsConnectionManager.removeSubscription('presence_sync');
    }

    // --- Watch Management (tell backend who to track) ---

    /** Tell backend to start tracking presence for specific users */
    subscribeToUserPresence(userIds: string[]): void {
        if (!userIds.length) return;
        wsConnectionManager.publish(WS_DESTINATIONS.PRESENCE_SUBSCRIBE, JSON.stringify({ userIds }));
        logger.debug('[PresenceWsService] Subscribed to user presence:', userIds.length, 'users');
    }

    /** Tell backend to stop tracking presence for specific users */
    unsubscribeFromUserPresence(userIds: string[]): void {
        if (!userIds.length) return;
        wsConnectionManager.publish(WS_DESTINATIONS.PRESENCE_UNSUBSCRIBE, JSON.stringify({ userIds }));
        logger.debug('[PresenceWsService] Unsubscribed from user presence:', userIds.length, 'users');
    }

    // --- Pull-on-Reconnect ---

    /**
     * Request batch presence for a list of users.
     * Response arrives on /user/queue/presence-batch.
     */
    requestBatchPresence(userIds: string[]): void {
        if (!wsConnectionManager.isConnected()) {
            logger.warn('[PresenceWsService] Cannot request batch presence - not connected');
            return;
        }

        if (!userIds.length) return;

        const uniqueUserIds = [...new Set(userIds.filter(id => id && id.trim()))];
        wsConnectionManager.publish(
            WS_DESTINATIONS.REQUEST_ONLINE_STATUS,
            JSON.stringify({ userIds: uniqueUserIds })
        );
        logger.debug('[PresenceWsService] Requested batch presence for', uniqueUserIds.length, 'users');
    }

    // --- Heartbeat ---

    /** Send a single heartbeat to keep session alive */
    sendHeartbeat(deviceInfo?: string, sessionId?: string): void {
        const payload: Record<string, unknown> = { timestamp: Date.now() };
        if (sessionId) payload.sessionId = sessionId;
        if (deviceInfo) payload.deviceInfo = deviceInfo;

        wsConnectionManager.publish(WS_DESTINATIONS.PRESENCE_HEARTBEAT, JSON.stringify(payload));
        logger.debug('[PresenceWsService] Heartbeat sent');
    }

    /** Start periodic heartbeat (30s default, server TTL is 45s) */
    startHeartbeat(intervalMs: number = 30000): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        // Send first heartbeat immediately to ensure session is active in Redis
        if (wsConnectionManager.isConnected()) {
            this.sendHeartbeat();
        }

        this.heartbeatInterval = setInterval(() => {
            if (wsConnectionManager.isConnected()) {
                this.sendHeartbeat();
            }
        }, intervalMs);
        logger.debug('[PresenceWsService] Heartbeat started:', intervalMs, 'ms');
    }

    /** Stop periodic heartbeat */
    stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            logger.debug('[PresenceWsService] Heartbeat stopped');
        }
    }

    /** 
     * Send explicit logout signal to backend for instant offline status.
     * Use this before disconnecting the WebSocket.
     */
    sendLogout(): void {
        if (wsConnectionManager.isConnected()) {
            wsConnectionManager.publish(WS_DESTINATIONS.PRESENCE_LOGOUT, JSON.stringify({}));
            logger.info('[PresenceWsService] Sent explicit logout signal');
        }
    }

    // --- Lifecycle ---

    /** Shutdown presence system cleanly */
    shutdownPresenceSystem(): void {
        this.stopHeartbeat();
        this.unsubscribeFromPresenceEvents();
        logger.debug('[PresenceWsService] Presence system shut down');
    }

    /** Check if presence system is active */
    isPresenceSystemActive(): boolean {
        return wsConnectionManager.hasSubscription('presence_queue') &&
            this.heartbeatInterval !== null;
    }

    // --- Private handlers: update presenceStore directly ---

    private handlePresenceUpdate(data: PresenceEvent): void {
        const isOnline = data.isOnline ?? data.online ??
            (data.status === 'ONLINE' || data.status === 'DND');

        logger.info('[PresenceWsService] Presence update:', data.userId,
            data.status ?? (isOnline ? 'ONLINE' : 'OFFLINE'));
        // additional console log for easier client-side debugging
        logger.debug('[PresenceWsService] event received ->', data);

        const store = usePresenceStore.getState();
        store.updateOnlineStatus({
            userId: data.userId,
            online: isOnline,
            isOnline: isOnline,
            timestamp: data.timestamp || new Date().toISOString(),
            lastSeen: data.lastActive ?? undefined,
            status: data.status,
        });
    }

    private handleBatchPresenceResponse(data: Record<string, UserPresence>): void {
        logger.debug('[PresenceWsService] Batch presence response:', Object.keys(data).length, 'users');

        const store = usePresenceStore.getState();
        store.setMultiplePresences(data);
    }
}

export const presenceWsService = new PresenceWsService();
