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
  online?: boolean;
  isOnline?: boolean;
  status?: PublicPresenceStatus | PresencePreferenceStatus | 'OFFLINE';
  timestamp: string;
  lastSeen?: string | null;
  device?: string;
  lastActiveAgo?: string | null;
  requestId?: string;
  traceId?: string;
}

export interface NormalizedPresenceEvent {
  userId: string;
  online: boolean;
  status: PublicPresenceStatus | PresencePreferenceStatus;
  timestamp: string;
  lastSeen: string | null;
  device?: string;
  lastActiveAgo?: string | null;
}

export const isPublicPresenceStatus = (value: unknown): value is PublicPresenceStatus => {
  return value === 'ONLINE' || value === 'OFFLINE' || value === 'DND';
};

export const normalizeOnlineStatusEvent = (value: OnlineStatusEvent | null | undefined): NormalizedPresenceEvent | null => {
  if (!value || typeof value.userId !== 'string' || !value.userId.trim()) {
    return null;
  }

  const online = value.isOnline ?? value.online ?? false;
  const rawStatus = typeof value.status === 'string' ? value.status.toUpperCase() : '';
  const status: PublicPresenceStatus | PresencePreferenceStatus = isPublicPresenceStatus(rawStatus)
    ? rawStatus
    : online
      ? 'ONLINE'
      : 'OFFLINE';

  return {
    userId: value.userId,
    online,
    status,
    timestamp: value.timestamp,
    lastSeen: value.lastSeen ?? null,
    device: value.device,
    lastActiveAgo: value.lastActiveAgo ?? null,
  };
};

export interface PresenceSubscriptionEvent {
  watchedUserId: string;
}

export interface HeartbeatEvent {
  timestamp: number;
}
