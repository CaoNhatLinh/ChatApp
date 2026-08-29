export interface UserProfileModal {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  joinedAt?: string;
  lastSeen?: string;
  role?: 'admin' | 'moderator' | 'member';
  mutualFriends?: number;
}
