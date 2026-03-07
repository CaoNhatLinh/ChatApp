// src/services/ws/wsConnectionManager.ts
// Shared WebSocket connection state and utilities

import { getStompClient } from '../websocketService';
import { logger } from '@/utils/logger';
import type { StompSubscription } from '@stomp/stompjs';

/**
 * Manages shared WebSocket connection state: subscriptions, auth headers, publish.
 * All domain services (message, typing, presence, notification) depend on this.
 */
class WsConnectionManager {
    private subscriptions: Map<string, StompSubscription> = new Map();

    get stompClient() {
        return getStompClient();
    }

    /** Get Authorization header from stored token */
    getAuthHeaders(): Record<string, string> {
        const token = localStorage.getItem('token');
        if (token) {
            return { 'Authorization': `Bearer ${token}` };
        }
        return {};
    }

    /** Check if WebSocket is currently connected */
    isConnected(): boolean {
        return this.stompClient?.connected ?? false;
    }

    /** Get all active subscription keys */
    getActiveSubscriptions(): string[] {
        return Array.from(this.subscriptions.keys());
    }

    /** Check if a specific subscription exists */
    hasSubscription(key: string): boolean {
        return this.subscriptions.has(key);
    }

    /** Store a subscription by key */
    setSubscription(key: string, subscription: StompSubscription): void {
        this.subscriptions.set(key, subscription);
    }

    /** Get a subscription by key */
    getSubscription(key: string): StompSubscription | undefined {
        return this.subscriptions.get(key);
    }

    /** Remove and unsubscribe a subscription by key */
    removeSubscription(key: string): boolean {
        const subscription = this.subscriptions.get(key);
        if (subscription) {
            subscription.unsubscribe();
            this.subscriptions.delete(key);
            return true;
        }
        return false;
    }

    /** Remove subscriptions matching a prefix */
    removeSubscriptionsByPrefix(prefix: string): void {
        const keys = Array.from(this.subscriptions.keys()).filter(key => key.startsWith(prefix));
        keys.forEach(key => { this.removeSubscription(key); });
    }

    /** Unsubscribe from everything */
    unsubscribeAll(): void {
        this.subscriptions.forEach((subscription) => {
            try { subscription.unsubscribe(); } catch { /* may fail if connection is dead */ }
        });
        this.subscriptions.clear();
    }

    /**
     * Clear all subscription entries WITHOUT sending unsubscribe frames.
     * Use on reconnect when the old STOMP connection is already dead
     * and the subscription objects are stale.
     */
    clearStaleSubscriptions(): void {
        this.subscriptions.clear();
        logger.debug('[WsConnectionManager] Cleared all stale subscriptions');
    }

    /** Generic publish to a STOMP destination */
    publish(destination: string, body: string, headers?: Record<string, string>): void {
        if (!this.stompClient?.connected) {
            logger.warn('[WsConnectionManager] Cannot publish - not connected');
            return;
        }

        const mergedHeaders = { ...this.getAuthHeaders(), ...headers };
        this.stompClient.publish({
            destination,
            body,
            headers: mergedHeaders,
        });
        logger.debug('[WsConnectionManager] Published to:', destination);
    }

    /** Log all subscription status for debugging */
    logSubscriptionStatus(): void {
        logger.debug('[WsConnectionManager] Connection status:', this.isConnected());
        logger.debug('[WsConnectionManager] Total subscriptions:', this.subscriptions.size);
        logger.debug('[WsConnectionManager] All subscriptions:', this.getActiveSubscriptions());
    }
}

export const wsConnectionManager = new WsConnectionManager();
export { WsConnectionManager };
