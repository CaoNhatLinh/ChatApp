import type { UserDTO } from '@/entities/user/model/user.types';
export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';

export type FriendDetails = {
  userId: string;
  status: FriendshipStatus;
  userDetails: UserDTO[];
};
