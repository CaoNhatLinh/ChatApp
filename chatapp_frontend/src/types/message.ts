// src/types/message.ts

import type { UserDTO } from './user';

export type MessageType = 'text' | 'image' | 'notification';

export type MessageRequest = {
  conversationId: string;
  senderId: string;
  content: string;
  replyTo?: string;
  mentionedUserIds?: string[];
  type: 'text' | 'file' | 'image';
};

// Message attachment interface
export interface MessageAttachmentDto {
  attachmentId: string;
  fileName: string;
  url: string;
  fileSize: number;
  mimeType: string;
  attachmentType: string;
}

// Message reaction interface
export interface MessageReactionDto {
  count: number;
  emoji: string;
  latestUsers: UserDTO[];
  reactedByCurrentUser: boolean;
}

// Reply to interface
export interface ReplyToDto {
  messageId: string;
  content: string;
  sender: UserDTO;
}

// Image interface
export interface ImageDto {
  imageId: string;
  url: string;
  fileName: string;
  fileSize: number;
}

// Full message response from backend
export interface MessageResponseDto {
  messageId: string;
  conversationId: string;
  sender: UserDTO;
  content: string;
  mentionedUsers: string[];
  messageType: MessageType;
  attachments: MessageAttachmentDto[];
  images: ImageDto[];
  reactions: MessageReactionDto[];
  replyTo: ReplyToDto | null;
  replyType: string;
  isForwarded: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Optional status for UI purposes
  status?: 'sending' | 'sent' | 'delivered' | 'received' | 'failed';
  // Block status: true if viewer has blocked this sender
  senderBlockedByViewer?: boolean;
}

// Send message payload for HTTP
export interface SendMessageRequest {
  conversationId: string;
  content: string;
  messageType?: MessageType;
  replyTo?: string;
  mentionedUserIds?: string[];
}

// Send message payload for WebSocket with new format
export interface SendMessageWsPayload {
  type: "NEW_MESSAGE";
  payload: {
    conversationId: string;
    type: "TEXT" | "IMAGE" | "FILE"; // Changed from messageType to type to match backend
    content: string;
    mentions?: string[]; // Array of userIds being mentioned
    replyTo?: string; // UUID of message being replied to
    attachments?: string[]; // Array of attachment objects
  };
}

// Legacy WebSocket payload (keeping for compatibility)
export interface LegacySendMessageWsPayload {
  conversationId: string;
  content: string;
  mentionedUserIds?: string[];
  replyTo?: string;
}

// Message query parameters
export interface MessageQueryParams {
  before?: string;
  after?: string;
  limit?: number;
}

// Message summary for conversations
export interface MessageSummary {
  messageId: string;
  senderId: string;
  content: string;
  createdAt: string;
}
