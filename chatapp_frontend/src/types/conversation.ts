import type { UserDTO } from './user';
import type { MessageSummary } from './message';

// Conversation types
export type ConversationType = 'direct' | 'group' | 'channel' | 'dm';

// Main conversation interface
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
  
  // For DM conversations
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

// Backend conversation response DTO
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
  otherParticipant?: UserDTO; // for DM only
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

// Member management requests
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

// Invitation link types
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
  expiresInHours?: number; // Default: 24 hours
  maxUses?: number; // null = unlimited
}

// Conversation settings
export interface ConversationSettings {
  conversationId: string;
  notifications: boolean;
  muteUntil?: string;
  theme?: string;
  isArchived: boolean;
}
