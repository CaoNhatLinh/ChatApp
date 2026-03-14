import type { UserDTO } from '@/entities/user/model/user.types';

export type MessageType = 'text' | 'image' | 'notification';

export type MessageRequest = {
  conversationId: string;
  senderId: string;
  content: string;
  replyTo?: string;
  mentionedUserIds?: string[];
  type: 'text' | 'file' | 'image';
};

export interface MessageAttachmentDto {
  attachmentId: string;
  fileName: string;
  url: string;
  fileSize: number;
  mimeType: string;
  attachmentType: string;
}

export interface MessageReactionDto {
  count: number;
  emoji: string;
  latestUsers: UserDTO[];
  reactedByCurrentUser: boolean;
}

export interface ReplyToDto {
  messageId: string;
  content: string;
  sender: UserDTO;
}

export interface ImageDto {
  imageId: string;
  url: string;
  fileName: string;
  fileSize: number;
}

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
  status?: 'sending' | 'sent' | 'delivered' | 'received' | 'failed';
  senderBlockedByViewer?: boolean;
}

export interface SendMessageRequest {
  conversationId: string;
  content: string;
  messageType?: MessageType;
  replyTo?: string;
  mentionedUserIds?: string[];
}

export interface SendMessageWsPayload {
  type: 'NEW_MESSAGE';
  payload: {
    conversationId: string;
    type: 'TEXT' | 'IMAGE' | 'FILE';
    content: string;
    mentions?: string[];
    replyTo?: string;
    attachments?: string[];
  };
}

export interface LegacySendMessageWsPayload {
  conversationId: string;
  content: string;
  mentionedUserIds?: string[];
  replyTo?: string;
}

export interface MessageQueryParams {
  before?: string;
  after?: string;
  limit?: number;
}

export interface MessageSummary {
  messageId: string;
  senderId: string;
  content: string;
  createdAt: string;
}