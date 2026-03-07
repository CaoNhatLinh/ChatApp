// src/services/ws/messageWsService.ts
// WebSocket message operations: send, subscribe, unsubscribe

import { wsConnectionManager } from './wsConnectionManager';
import { logger } from '@/utils/logger';
import { WS_TOPICS, WS_DESTINATIONS, isMessageEvent } from '@/types/websocket';
import type { MessageResponseDto, SendMessageWsPayload } from '@/types/message';

class MessageWsService {
    /** Send a message via WebSocket */
    sendMessage(payload: SendMessageWsPayload): void {
        if (!wsConnectionManager.isConnected()) {
            logger.warn('[MessageWsService] WebSocket is not connected');
            return;
        }
        if (!payload.payload?.conversationId) {
            logger.error('[MessageWsService] Invalid payload: missing conversationId');
            return;
        }

        let destination: string = WS_DESTINATIONS.MESSAGE_SEND;
        if (payload.type === 'NEW_MESSAGE' && payload.payload.type === 'FILE') {
            destination = WS_DESTINATIONS.MESSAGE_FILE;
        }

        wsConnectionManager.publish(destination, JSON.stringify(payload));
    }

    /** Subscribe to messages for a conversation */
    subscribeToMessages(conversationId: string, callback: (message: MessageResponseDto) => void): void {
        if (!wsConnectionManager.stompClient?.connected) {
            logger.warn('[MessageWsService] WebSocket is not connected');
            return;
        }

        const conversationKey = `conversation_${conversationId}`;
        const topic = WS_TOPICS.CONVERSATION(conversationId);

        if (wsConnectionManager.hasSubscription(conversationKey)) {
            logger.debug('[MessageWsService] Already subscribed to conversation:', conversationId);
            return;
        }

        const subscription = wsConnectionManager.stompClient.subscribe(topic, (frame) => {
            try {
                const data: unknown = JSON.parse(frame.body);
                if (isMessageEvent(data)) {
                    callback(data);
                } else {
                    logger.debug('[MessageWsService] Invalid message event format');
                }
            } catch (error) {
                logger.error('[MessageWsService] Error parsing message event:', error instanceof Error ? error.message : error);
            }
        });

        wsConnectionManager.setSubscription(conversationKey, subscription);
        logger.debug('[MessageWsService] Subscribed to conversation:', conversationId);
    }

    /** Subscribe to message echoes (own messages reflected back) */
    subscribeToMessageEcho(callback: (message: MessageResponseDto) => void): void {
        if (!wsConnectionManager.stompClient?.connected) {
            logger.warn('[MessageWsService] WebSocket is not connected');
            return;
        }

        const subscription = wsConnectionManager.stompClient.subscribe(WS_TOPICS.MESSAGE_ECHO, (frame) => {
            try {
                const data: unknown = JSON.parse(frame.body);
                if (isMessageEvent(data)) {
                    callback(data);
                }
            } catch (error) {
                logger.error('[MessageWsService] Error parsing message echo:', error instanceof Error ? error.message : error);
            }
        });

        wsConnectionManager.setSubscription('message-echo', subscription);
    }

    /** Subscribe to WebSocket error messages */
    subscribeToErrors(callback: (error: string) => void): void {
        if (!wsConnectionManager.stompClient?.connected) {
            logger.warn('[MessageWsService] WebSocket is not connected');
            return;
        }

        const subscription = wsConnectionManager.stompClient.subscribe(WS_TOPICS.ERRORS, (frame) => {
            try {
                const data: unknown = JSON.parse(frame.body);
                logger.error('[MessageWsService] Received WebSocket error:', data);
                callback(data as string);
            } catch (error) {
                logger.error('[MessageWsService] Error parsing error message:', error instanceof Error ? error.message : error);
            }
        });

        wsConnectionManager.setSubscription('errors', subscription);
    }

    unsubscribeFromMessages(conversationId: string): void {
        const key = `conversation_${conversationId}`;
        if (wsConnectionManager.removeSubscription(key)) {
            logger.debug('[MessageWsService] Unsubscribed from:', conversationId);
        }
    }

    unsubscribeFromMessageEcho(): void {
        wsConnectionManager.removeSubscription('message-echo');
    }

    unsubscribeFromErrors(): void {
        wsConnectionManager.removeSubscription('errors');
    }
}

export const messageWsService = new MessageWsService();
export { MessageWsService };
