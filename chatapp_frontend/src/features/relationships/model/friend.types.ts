import type { UserDTO } from '@/entities/user/model/user.types';
export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';

export interface Friend {
  userId: string;
  friendId: string;
  avatarUrl: string;
  userName: string;
  displayName: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt?: string;
}

export type FriendshipEvents = {
  action: string;
  eventId: string;
  friendId: string;
  userId: string;
  metadata?: string;
};

export type FriendDetails = {
  userId: string;
  status: FriendshipStatus;
  userDetails: UserDTO[];
};