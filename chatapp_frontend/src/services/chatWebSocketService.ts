// src/services/chatWebSocketService.ts
//
// BACKWARD-COMPATIBLE FACADE
// This file delegates all methods to the new sub-services in services/ws/
// New code should import directly from services/ws/ sub-services.

import { wsConnectionManager } from './ws/wsConnectionManager';
import { messageWsService } from './ws/messageWsService';
import { typingWsService } from './ws/typingWsService';
import { presenceWsService } from './ws/presenceWsService';
import { notificationWsService } from './ws/notificationWsService';
import type { MessageResponseDto, SendMessageWsPayload } from '@/types/message';
import type {
  TypingEventReceived,
  NotificationReceived,
} from '@/types/websocket';

/**
 * Backward-compatible facade that delegates to focused sub-services.
 * @deprecated Import from `@/services/ws/` directly for new code.
 */
export class ChatWebSocketService {
  // --- Connection ---
  getAuthHeaders(): Record<string, string> { return wsConnectionManager.getAuthHeaders(); }
  isConnected(): boolean { return wsConnectionManager.isConnected(); }
  getActiveSubscriptions(): string[] { return wsConnectionManager.getActiveSubscriptions(); }
  hasSubscription(key: string): boolean { return wsConnectionManager.hasSubscription(key); }
  unsubscribeAll(): void { wsConnectionManager.unsubscribeAll(); }
  publish(destination: string, body: string, headers?: Record<string, string>): void {
    wsConnectionManager.publish(destination, body, headers);
  }
  logSubscriptionStatus(): void { wsConnectionManager.logSubscriptionStatus(); }

  // --- Messages ---
  sendMessage(payload: SendMessageWsPayload): void { messageWsService.sendMessage(payload); }
  subscribeToMessages(conversationId: string, callback: (message: MessageResponseDto) => void): void {
    messageWsService.subscribeToMessages(conversationId, callback);
  }
  subscribeToMessageEcho(callback: (message: MessageResponseDto) => void): void {
    messageWsService.subscribeToMessageEcho(callback);
  }
  subscribeToErrors(callback: (error: string) => void): void {
    messageWsService.subscribeToErrors(callback);
  }
  unsubscribeFromMessages(conversationId: string): void { messageWsService.unsubscribeFromMessages(conversationId); }
  unsubscribeFromMessageEcho(): void { messageWsService.unsubscribeFromMessageEcho(); }
  unsubscribeFromErrors(): void { messageWsService.unsubscribeFromErrors(); }

  // --- Typing ---
  sendTyping(conversationId: string, isTyping: boolean): void { typingWsService.sendTyping(conversationId, isTyping); }
  subscribeToTyping(conversationId: string, callback: (event: TypingEventReceived) => void): void {
    typingWsService.subscribeToTyping(conversationId, callback);
  }
  unsubscribeFromTyping(conversationId?: string): void { typingWsService.unsubscribeFromTyping(conversationId); }

  // --- Presence (only methods that still exist) ---
  setStatus(status: 'ONLINE' | 'DND'): void { presenceWsService.setStatus(status); }
  sendHeartbeat(deviceInfo?: string, sessionId?: string): void { presenceWsService.sendHeartbeat(deviceInfo, sessionId); }
  startHeartbeat(intervalMs?: number): void { presenceWsService.startHeartbeat(intervalMs); }
  stopHeartbeat(): void { presenceWsService.stopHeartbeat(); }
  shutdownPresenceSystem(): void { presenceWsService.shutdownPresenceSystem(); }
  isPresenceSystemActive(): boolean { return presenceWsService.isPresenceSystemActive(); }

  // --- Notifications ---
  subscribeToNotifications(callback: (event: NotificationReceived) => void): void {
    notificationWsService.subscribeToNotifications(callback);
  }
  markNotificationAsRead(notificationId: string): void { notificationWsService.markNotificationAsRead(notificationId); }
  markAllNotificationsAsRead(): void { notificationWsService.markAllNotificationsAsRead(); }
  unsubscribeFromNotifications(): void { notificationWsService.unsubscribeFromNotifications(); }
}

// Singleton instance
// eslint-disable-next-line @typescript-eslint/no-deprecated
export const chatWebSocketService = new ChatWebSocketService();
