

import type { UserDTO } from "./user";


export interface Friend {
  userId: string;
  friendId: string;
  avatarUrl: string;
  userName: string;
  displayName: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';
  createdAt: string;
  updatedAt?: string;
}


export type friendshipEvents = {
 action :string;
 eventId : string;
 friendId : string;
  userId : string;
  metadata?: string;
};

export type FriendDetails = {
  userId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';
  userDetails: UserDTO[];
};