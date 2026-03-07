// src/types/presence.ts

export interface UserPresence {
  userId: string;
  status: 'ONLINE' | 'OFFLINE' | 'AWAY' | 'DND' | 'INVISIBLE';
  isOnline: boolean;
  lastSeen: string | null;
  lastActiveAgo: string | null;
  device?: string;
  sessionId?: string;
}

export interface PresenceResponse {
  [userId: string]: UserPresence;
}

export interface OnlineStatusEvent {
  userId: string;
  online: boolean;
  isOnline: boolean;
  timestamp: string;
  lastSeen?: string | null;
  device?: string;
  /** Custom status: ONLINE, DND, INVISIBLE, OFFLINE */
  status?: string;
}

export interface PresenceSubscriptionEvent {
  watchedUserId: string;
}

export interface HeartbeatEvent {
  timestamp: number;
}

