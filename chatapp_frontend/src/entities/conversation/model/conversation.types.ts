import type { UserDTO } from '@/entities/user/model/user.types';
import type { MessageSummary } from '@/entities/message/model/message.types';

export type ConversationType = 'direct' | 'group' | 'channel' | 'dm';

export interface Conversation {
  conversationId: string;
  name: string;
  type: ConversationType;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  isDeleted?: boolean;
  backgroundUrl?: string;
  otherParticipant?: {
    userId: string;
    username: string;
    displayName?: string;
    email?: string;
    avatarUrl?: string;
    isOnline: boolean;
  };
  lastMessage?: {
    messageId: string;
    senderId: string;
    senderName?: string;
    content: string;
    messageType?: string;
    createdAt: string;
  };
  memberCount?: number;
}

export interface ConversationResponseDto {
  conversationId: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
  description: string;
  createdBy: string;
  backgroundUrl: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  memberCount: number;
  otherParticipant?: UserDTO;
  lastMessage?: MessageSummary;
}

export interface CreateConversationRequest {
  name: string;
  type: 'group' | 'dm';
  description?: string;
  memberIds: string[];
}

export interface ConversationRequest {
  name?: string;
  description?: string;
  type: ConversationType;
  memberIds?: string[];
}

export interface ConversationMember {
  userId: string;
  conversationId: string;
  role: 'owner' | 'admin' | 'member' | 'moderator';
  joinedAt: string;
  isActive: boolean;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface AddMemberRequest {
  memberIds: string[];
}

export interface RemoveMemberRequest {
  userId: string;
  reason?: string;
}

export interface TransferOwnershipRequest {
  newOwnerId: string;
}

export interface GrantAdminRequest {
  userId: string;
}

export interface InvitationLink {
  linkId: string;
  conversationId: string;
  linkToken: string;
  fullLink: string;
  createdBy: string;
  createdByUsername: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  maxUses?: number;
  usedCount: number;
  isExpired: boolean;
  canDelete: boolean;
}

export interface CreateInvitationLinkRequest {
  expiresInHours?: number;
  maxUses?: number;
}

export interface ConversationSettings {
  conversationId: string;
  notifications: boolean;
  muteUntil?: string;
  theme?: string;
  isArchived: boolean;
}