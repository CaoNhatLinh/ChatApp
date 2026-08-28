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

export interface OnlineStatusEvent {
  userId: string;
  online: boolean;
  status: PublicPresenceStatus | PresencePreferenceStatus | 'OFFLINE';
  timestamp: string;
  lastSeen: string | null;
  device: string | null;
  lastActiveAgo: string | null;
  requestId: string | null;
  traceId: string | null;
}

export interface NormalizedPresenceEvent {
  userId: string;
  online: boolean;
  status: PublicPresenceStatus | PresencePreferenceStatus;
  timestamp: string;
  lastSeen: string | null;
  device: string | null;
  lastActiveAgo: string | null;
}

export const isPublicPresenceStatus = (value: unknown): value is PublicPresenceStatus => {
  return value === 'ONLINE' || value === 'OFFLINE' || value === 'DND';
};

export const normalizeOnlineStatusEvent = (value: OnlineStatusEvent | null | undefined): NormalizedPresenceEvent | null => {
  if (!value || typeof value.userId !== 'string' || !value.userId.trim()
    || typeof value.online !== 'boolean'
    || typeof value.status !== 'string'
    || typeof value.timestamp !== 'string' || !value.timestamp.trim()
    || (value.lastSeen !== null && typeof value.lastSeen !== 'string')
    || (value.device !== null && typeof value.device !== 'string')
    || (value.lastActiveAgo !== null && typeof value.lastActiveAgo !== 'string')) {
    return null;
  }

  const rawStatus = value.status.toUpperCase();
  if (!isPublicPresenceStatus(rawStatus) && rawStatus !== 'INVISIBLE') {
    return null;
  }
  const status: PublicPresenceStatus | PresencePreferenceStatus = rawStatus === 'INVISIBLE'
    ? 'OFFLINE'
    : rawStatus;

  return {
    userId: value.userId,
    online: rawStatus === 'INVISIBLE' ? false : value.online,
    status,
    timestamp: value.timestamp,
    lastSeen: value.lastSeen,
    device: value.device,
    lastActiveAgo: value.lastActiveAgo,
  };
};

export interface PresenceSubscriptionEvent {
  watchedUserId: string;
}

export interface HeartbeatEvent {
  timestamp: number;
}
