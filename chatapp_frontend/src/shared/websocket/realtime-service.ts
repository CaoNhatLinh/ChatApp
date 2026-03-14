import type { IMessage, StompHeaders, StompSubscription } from '@stomp/stompjs';
import { logger } from '@/shared/lib/logger';
import { connectWebSocket, getStompClient, addConnectionListener } from '@/shared/websocket/websocketService';

export type RealtimeCallback<T = unknown> = (payload: T) => void;

class RealtimeService {
    private subscriptions: Map<string, StompSubscription> = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private callbacks: Map<string, Set<RealtimeCallback<any>>> = new Map();

    private get client() {
        return getStompClient();
    }

    public async connect(token: string): Promise<void> {
        if (this.client?.active) {
            // Even if active, ensure we have a listener for potential future reconnects
            this.ensureConnectionListener();
            return;
        }

        // Use the shared connectWebSocket instead of creating a private client
        await connectWebSocket(token);

        this.ensureConnectionListener();
        this.restoreSubscriptions();
        logger.info('RealtimeService synced with shared WebSocket connection');
    }

    private connectionListenerUnsub: (() => void) | null = null;

    private ensureConnectionListener() {
        if (this.connectionListenerUnsub) return;
        
        this.connectionListenerUnsub = addConnectionListener(() => {
            logger.info('[RealtimeService] Connection detected, restoring subscriptions...');
            this.restoreSubscriptions();
        });
    }

    public isConnected(): boolean {
        return this.client?.connected ?? false;
    }

    public disconnect() {
        // We probably don't want to disconnect the global client here
        // as other services might be using it.
        this.subscriptions.clear();
        this.callbacks.clear();
        logger.info('RealtimeService tracking cleared');
    }

    public subscribe<T>(destination: string, callback: RealtimeCallback<T>): () => void {
        // Register callback
        if (!this.callbacks.has(destination)) {
            this.callbacks.set(destination, new Set());
        }
        const callbacks = this.callbacks.get(destination);
        if (callbacks) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            callbacks.add(callback as RealtimeCallback<any>);
        }

        // If client is connected and not yet subscribed to this destination
        if (this.client?.connected && !this.subscriptions.has(destination)) {
            this.createSubscription(destination);
        }

        // Return unsubscribe function
        return () => {
            const destCallbacks = this.callbacks.get(destination);
            if (destCallbacks) {
                destCallbacks.delete(callback);
                if (destCallbacks.size === 0) {
                    this.unsubscribe(destination);
                }
            }
        };
    }

    private createSubscription(destination: string) {
        if (!this.client?.connected) return;

        const subscription = this.client.subscribe(destination, (message: IMessage) => {
            try {
                const payload = JSON.parse(message.body) as unknown;
                const destCallbacks = this.callbacks.get(destination);
                destCallbacks?.forEach(cb => cb(payload));
            } catch (err) {
                logger.error('Failed to parse websocket message', err instanceof Error ? err.message : err);
            }
        });

        this.subscriptions.set(destination, subscription);
        logger.debug(`Subscribed to ${destination}`);
    }

    private unsubscribe(destination: string) {
        const sub = this.subscriptions.get(destination);
        if (sub) {
            sub.unsubscribe();
            this.subscriptions.delete(destination);
            logger.debug(`Unsubscribed from ${destination}`);
        }
    }

    private restoreSubscriptions() {
        this.callbacks.forEach((_, destination) => {
            this.createSubscription(destination);
        });
    }

    public publish<T>(destination: string, body: T, headers?: StompHeaders) {
        if (!this.client?.connected) {
            logger.warn(`Cannot publish to ${destination} - not connected`);
            return;
        }

        this.client.publish({
            destination,
            body: JSON.stringify(body),
            headers,
        });
        logger.debug(`Published message to ${destination}`);
    }
}

export const realtimeService = new RealtimeService();
export default realtimeService;
