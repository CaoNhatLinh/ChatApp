// src/types/websocket.ts

import { logger } from '@/utils/logger';
import type { MessageResponseDto } from './message';
import type { UserDTO } from './user';

// Message event interfaces
export interface MessageEvent {
  type: 'MESSAGE_SEND' | 'MESSAGE_RECEIVED';
  payload: MessageResponseDto;
}

export interface TypingEvent {
  conversationId: string;
  isTyping: boolean;
}

export interface TypingEventReceived {
  conversationId: string;
  user?: UserDTO;
  isTyping: boolean;
  timestamp?: string;
}

// Presence event interface (canonical types in @/types/presence)
export interface PresenceEvent {
  userId: string;
  status?: string;      // ONLINE, OFFLINE, DND
  isOnline?: boolean;   // From UserPresenceResponse logic
  online?: boolean;     // From OnlineStatusEvent (backend push)
  lastActive?: string | null;
  lastActiveAgo?: string | null;
  device?: string;
  timestamp?: string;
}

// Notification event interfaces
export interface NotificationReadEvent {
  notificationId: string;
}

export interface NotificationReceived {
  notificationId: string;
  type: 'message' | 'friend_request' | 'mention';
  data: Record<string, NotificationReadEvent>;
  isRead: boolean;
  createdAt: string;
}

// WebSocket connection states
export type WebSocketState = 'connecting' | 'connected' | 'disconnected' | 'error';

// WebSocket subscription topics
export const WS_TOPICS = {
  // Message topics
  CONVERSATION: (conversationId: string) => `/topic/conversation/${conversationId}`, // For all participants (real-time broadcast)

  // Conversation-specific topics
  CONVERSATION_TYPING: (conversationId: string) => `/topic/conversation/${conversationId}/typing`,

  // User-specific queues (personal)
  TYPING: '/queue/typing', // Deprecated - use CONVERSATION_TYPING instead
  ONLINE_STATUS: '/queue/online-status',
  NOTIFICATIONS: '/queue/notifications',
  MESSAGE_ECHO: 'user/queue/message-echo', // For message sender (immediate confirmation)
  ERRORS: '/queue/errors', // Error messages

  // Targeted presence queue (from PresenceService.broadcastStatusToWatchers)
  PRESENCE_QUEUE: '/user/queue/presence',
  PRESENCE_BATCH: '/user/queue/presence-batch',

} as const;

// WebSocket destination endpoints
export const WS_DESTINATIONS = {
  // Message actions
  MESSAGE_SEND: '/app/message.send', // Text messages
  MESSAGE_FILE: '/app/message.file', // File messages

  // Typing actions
  TYPING: '/app/typing',

  // Presence actions
  ONLINE_STATUS: '/app/online-status',
  REQUEST_ONLINE_STATUS: '/app/presence.batch',
  PRESENCE_SUBSCRIBE: '/app/presence.subscribe',
  PRESENCE_UNSUBSCRIBE: '/app/presence.unsubscribe',
  PRESENCE_HEARTBEAT: '/app/heartbeat',
  PRESENCE_LOGOUT: '/app/presence/logout',

  // Notification actions
  NOTIFICATION_READ: '/app/notification.read',
} as const;

// WebSocket event type guards
export const isMessageEvent = (data: unknown): data is MessageResponseDto => {
  const d = data as Record<string, unknown> | null | undefined;
  const hasBasicFields = d &&
    typeof d.messageId === 'string' &&
    typeof d.conversationId === 'string';

  const sender = d?.sender as Record<string, unknown> | null | undefined;
  const hasSender = sender &&
    typeof sender === 'object' &&
    typeof sender.userId === 'string';

  const isValid = hasBasicFields && hasSender;

  if (!isValid) {
    logger.warn('[isMessageEvent] Invalid message structure:', {
      hasMessageId: !!d?.messageId,
      hasConversationId: !!d?.conversationId,
      hasSender: !!d?.sender,
      senderUserId: sender?.userId,
      actualData: data
    });
  }

  return !!isValid;
};

export const isTypingEvent = (data: unknown): data is TypingEventReceived => {
  const d = data as Record<string, unknown> | null | undefined;
  return !!d && typeof d.conversationId === 'string' && typeof d.isTyping === 'boolean';
};

export const isPresenceEvent = (data: unknown): data is PresenceEvent => {
  const d = data as Record<string, unknown> | null | undefined;
  return !!d && typeof d.userId === 'string' && (typeof d.isOnline === 'boolean' || typeof d.status === 'string');
};

export const isNotificationEvent = (data: unknown): data is NotificationReceived => {
  const d = data as Record<string, unknown> | null | undefined;
  return !!d && typeof d.notificationId === 'string' && typeof d.type === 'string';
};
