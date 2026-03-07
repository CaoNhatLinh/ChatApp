// src/services/ws/typingWsService.ts
// WebSocket typing indicator operations

import { wsConnectionManager } from './wsConnectionManager';
import { logger } from '@/utils/logger';
import { WS_TOPICS, WS_DESTINATIONS, isTypingEvent } from '@/types/websocket';
import type { TypingEvent, TypingEventReceived } from '@/types/websocket';

class TypingWsService {
    /** Send typing indicator to a conversation */
    sendTyping(conversationId: string, isTyping: boolean): void {
        if (!wsConnectionManager.isConnected()) {
            logger.warn('[TypingWsService] WebSocket is not connected');
            return;
        }

        const payload: TypingEvent = { conversationId, isTyping };
        wsConnectionManager.publish(WS_DESTINATIONS.TYPING, JSON.stringify(payload));
    }

    /** Subscribe to typing events for a conversation */
    subscribeToTyping(conversationId: string, callback: (event: TypingEventReceived) => void): void {
        if (!wsConnectionManager.stompClient?.connected) {
            logger.warn('[TypingWsService] WebSocket is not connected');
            return;
        }

        const typingKey = `typing_${conversationId}`;
        const topic = WS_TOPICS.CONVERSATION_TYPING(conversationId);

        if (wsConnectionManager.hasSubscription(typingKey)) {
            return;
        }

        const subscription = wsConnectionManager.stompClient.subscribe(topic, (frame) => {
            try {
                const data: unknown = JSON.parse(frame.body);
                if (isTypingEvent(data)) {
                    callback(data);
                }
            } catch (error) {
                logger.error('[TypingWsService] Error parsing typing event:', error instanceof Error ? error.message : error);
            }
        });

        wsConnectionManager.setSubscription(typingKey, subscription);
        logger.debug('[TypingWsService] Subscribed to typing for conversation:', conversationId);
    }

    /** Unsubscribe from typing events (specific conversation or all) */
    unsubscribeFromTyping(conversationId?: string): void {
        if (conversationId) {
            wsConnectionManager.removeSubscription(`typing_${conversationId}`);
        } else {
            wsConnectionManager.removeSubscriptionsByPrefix('typing_');
        }
    }
}

export const typingWsService = new TypingWsService();
export { TypingWsService };
