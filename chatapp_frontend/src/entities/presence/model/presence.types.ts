export type PublicPresenceStatus = 'ONLINE' | 'OFFLINE' | 'DND';

export type PresencePreferenceStatus = 'ONLINE' | 'DND' | 'INVISIBLE';

export interface UserPresence {
  userId: string;
  status: PublicPresenceStatus;
  isOnline: boolean;
  lastSeen: string | null;
  lastActiveAgo: string | null;
  device?: string;
  sessionId?: string;
}

export type PresenceResponse = Record<string, UserPresence>;

export interface OnlineStatusEvent {
  userId: string;
  online: boolean;
  isOnline: boolean;
  timestamp: string;
  lastSeen?: string | null;
  device?: string;
  status?: PublicPresenceStatus | PresencePreferenceStatus;
}

export interface PresenceSubscriptionEvent {
  watchedUserId: string;
}

export interface HeartbeatEvent {
  timestamp: number;
}