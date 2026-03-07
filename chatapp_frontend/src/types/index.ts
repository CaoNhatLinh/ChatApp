// Types - centralized exports

// User types
export type { UserDTO, UserSearchResult } from './user';

// Message types
export type {
  MessageType,
  MessageAttachmentDto,
  MessageReactionDto,
  ReplyToDto,
  ImageDto,
  MessageResponseDto,
  SendMessageRequest,
  SendMessageWsPayload,
  MessageQueryParams,
  MessageSummary,
  // Legacy types
  MessageRequest,
} from './message';

// Conversation types
export type {
  ConversationResponseDto,
  CreateConversationRequest,
  ConversationMember,
  ConversationSettings,
} from './conversation';

// API types
export type {
  ApiResponse,
  ApiError,
  PaginationParams,
  PaginatedResponse,
  BaseQueryParams,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from './api';

// WebSocket types
export type {
  TypingEvent,
  TypingEventReceived,
  PresenceEvent,
  NotificationReadEvent,
  NotificationReceived,
  WebSocketState,
} from './websocket';

export {
  WS_TOPICS,
  WS_DESTINATIONS,
  isMessageEvent,
  isTypingEvent,
  isPresenceEvent,
  isNotificationEvent,
} from './websocket';
