// src/services/ws/notificationWsService.ts
// WebSocket notification operations

import { wsConnectionManager } from './wsConnectionManager';
import { logger } from '@/utils/logger';
import { WS_TOPICS, isNotificationEvent } from '@/types/websocket';
import type { NotificationReceived } from '@/types/websocket';

class NotificationWsService {
    /** Subscribe to real-time notifications */
    subscribeToNotifications(callback: (event: NotificationReceived) => void): void {
        if (!wsConnectionManager.stompClient?.connected) {
            logger.warn('[NotificationWsService] Cannot subscribe - not connected');
            return;
        }

        if (wsConnectionManager.hasSubscription('notifications')) {
            logger.debug('[NotificationWsService] Already subscribed to notifications');
            return;
        }

        const subscription = wsConnectionManager.stompClient.subscribe(WS_TOPICS.NOTIFICATIONS, (frame) => {
            try {
                const data: unknown = JSON.parse(frame.body);
                if (isNotificationEvent(data)) {
                    callback(data);
                }
            } catch (error) {
                logger.error('[NotificationWsService] Error parsing notification:', error instanceof Error ? error.message : error);
            }
        });

        wsConnectionManager.setSubscription('notifications', subscription);
        logger.debug('[NotificationWsService] Notifications subscription created');
    }

    /** Mark a single notification as read */
    markNotificationAsRead(notificationId: string): void {
        wsConnectionManager.publish(
            '/app/notification.read',
            JSON.stringify({ notificationId })
        );
        logger.debug('[NotificationWsService] Marked notification as read:', notificationId);
    }

    /** Mark all notifications as read */
    markAllNotificationsAsRead(): void {
        wsConnectionManager.publish(
            '/app/notifications.read-all',
            JSON.stringify({})
        );
        logger.debug('[NotificationWsService] Marked all notifications as read');
    }

    /** Unsubscribe from notifications */
    unsubscribeFromNotifications(): void {
        wsConnectionManager.removeSubscription('notifications');
    }
}

export const notificationWsService = new NotificationWsService();
export { NotificationWsService };
