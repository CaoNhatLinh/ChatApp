// src/types/roomActions.ts

export interface RoomMember {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: string;
  isOnline: boolean;
}

export interface PinnedMessage {
  messageId: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  pinnedAt: string;
  pinnedBy: string;
}

export interface RoomSettings {
  conversationId: string;
  name: string;
  description?: string;
  backgroundUrl?: string;
  isPrivate: boolean;
  allowMemberInvite: boolean;
  maxMembers?: number;
}

export type RoomActionType = 
  | 'PROMOTE_TO_ADMIN'
  | 'DEMOTE_FROM_ADMIN'
  | 'PROMOTE_TO_MODERATOR'
  | 'DEMOTE_FROM_MODERATOR'
  | 'KICK_MEMBER'
  | 'BAN_MEMBER'
  | 'UNBAN_MEMBER'
  | 'DISSOLVE_ROOM';

export interface RoomActionRequest {
  conversationId: string;
  targetUserId: string;
  action: RoomActionType;
  reason?: string;
}

export interface MessageActionRequest {
  messageId: string;
  action: 'PIN' | 'UNPIN' | 'DELETE' | 'EDIT';
  content?: string; // For edit action
}

export interface UserProfileModal {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  joinedAt: string;
  lastSeen?: string;
  isOnline: boolean;
  role?: 'admin' | 'moderator' | 'member';
  mutualFriends?: number;
}
