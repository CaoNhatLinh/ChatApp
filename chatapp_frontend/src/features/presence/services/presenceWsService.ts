import { usePresenceStore } from '@/features/presence/model/presence.store';
import {
    isPublicPresenceStatus,
    normalizeOnlineStatusEvent,
    type PresencePreferenceStatus,
} from '@/entities/presence/model/presence.types';
import { isWebSocketReady, send, subscribe, unsubscribe } from '@/shared/websocket/websocketService';
import { logger } from '@/shared/lib/logger';

const PRESENCE_QUEUE = '/user/queue/presence';
const PRESENCE_SYNC_QUEUE = '/user/queue/presence-sync';
const PRESENCE_BATCH_QUEUE = '/user/queue/presence-batch';
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let cachedDeviceInfo: string | null = null;

interface RawPresenceBatchEntry {
    online?: boolean;
    isOnline?: boolean;
    status?: string;
    lastSeen?: string | null;
    device?: string;
    lastActiveAgo?: string | null;
    timestamp?: string;
}

export type PresenceSyncResult = {
    requestId: string;
    traceId: string;
};

function toStringArray(userIds: string[]): string[] {
  return [...new Set(userIds.filter(Boolean))];
}

function generateTraceId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return `presence-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizePresenceStatusValue(status: unknown): PresencePreferenceStatus | 'OFFLINE' | undefined {
    if (typeof status !== 'string') {
        return undefined;
    }

    const normalized = status.toUpperCase();
    return isPublicPresenceStatus(normalized) || normalized === 'INVISIBLE'
        ? (normalized as PresencePreferenceStatus | 'OFFLINE')
        : undefined;
}

function toStringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function normalizePresenceBatchPayload(payload: unknown) {
    if (!payload || typeof payload !== 'object') {
        return [];
    }

    return Object.entries(payload as Record<string, unknown>).map(([userId, raw]) => {
        const eventRecord = typeof raw === 'object' && raw !== null ? raw as RawPresenceBatchEntry : {};

        return normalizeOnlineStatusEvent({
            userId,
            online: Boolean(eventRecord.online ?? eventRecord.isOnline),
            status: normalizePresenceStatusValue(eventRecord.status),
            timestamp: typeof eventRecord.timestamp === 'string' ? eventRecord.timestamp : new Date().toISOString(),
            lastSeen: typeof eventRecord.lastSeen === 'string' ? eventRecord.lastSeen : null,
            device: typeof eventRecord.device === 'string' ? eventRecord.device : undefined,
            lastActiveAgo: typeof eventRecord.lastActiveAgo === 'string' ? eventRecord.lastActiveAgo : null,
        });
    }).filter((item): item is NonNullable<typeof item> => item !== null);
}

function resolveDeviceInfo(): string {
  if (cachedDeviceInfo) {
    return cachedDeviceInfo;
  }

  const ua = typeof navigator !== 'undefined' && navigator?.userAgent ? navigator.userAgent : '';
  const uaLower = ua.toLowerCase();
  const hasDesktopHint = /windows|macintosh|mac os x|linux|cros/i.test(ua);
  const hasMobileHint = /android|iphone|ipad|ipod|windows phone|mobile/i.test(uaLower);

  const os =
    /iphone|ipod/i.test(uaLower)
      ? 'iOS'
      : /ipad/i.test(uaLower)
        ? 'iPadOS'
        : /android/i.test(uaLower)
          ? 'Android'
          : /macintosh|mac os x|mac_intel|mac os/i.test(uaLower)
            ? 'macOS'
            : /windows/i.test(uaLower)
              ? 'Windows'
              : /linux/i.test(uaLower)
                ? 'Linux'
                : 'Unknown OS';

  const browser =
    /edg\//i.test(uaLower)
      ? 'Edge'
      : /opr\//i.test(uaLower) || /opera/i.test(uaLower)
        ? 'Opera'
        : /chrome/i.test(uaLower)
          ? 'Chrome'
          : /firefox/i.test(uaLower)
            ? 'Firefox'
            : /safari/i.test(uaLower)
              ? 'Safari'
              : 'Browser';

  cachedDeviceInfo = `${hasMobileHint ? 'Mobile' : hasDesktopHint ? 'Desktop' : 'Device'} • ${os} • ${browser}`;
  return cachedDeviceInfo;
}

function subscribeToUserPresence(userIds: string[]): void {
  const uniqueUserIds = toStringArray(userIds);
  if (uniqueUserIds.length > 0) {
    send('/app/presence.subscribe', {
      userIds: uniqueUserIds,
      requestId: generateTraceId(),
      traceId: generateTraceId(),
    });
  }
}

export const presenceWsService = {
  subscribeToUserPresence,

  unsubscribeFromUserPresence(userIds: string[]): void {
    const uniqueUserIds = toStringArray(userIds);
    if (uniqueUserIds.length > 0) {
      send('/app/presence.unsubscribe', {
        userIds: uniqueUserIds,
        requestId: generateTraceId(),
        traceId: generateTraceId(),
      });
    }
  },

  subscribeToPresenceEvents(): void {
    subscribe(PRESENCE_QUEUE, (payload) => {
      const event = normalizeOnlineStatusEvent(payload as never);
      if (!event) {
        logger.warn('[Presence] Ignored malformed presence event');
        return;
      }
      usePresenceStore.getState().updateOnlineStatus(event);
    });
  },

  subscribeToPresenceSync(
    onStatusSync: (status: PresencePreferenceStatus, requestId: string | null, traceId: string | null) => void,
    onRateLimit: (retryAfter: number, requestId: string | null, traceId: string | null) => void,
    onStatusSyncError: (errorType: string, message: string, requestId: string | null, traceId: string | null) => void
  ): void {
    subscribe(PRESENCE_SYNC_QUEUE, (payload) => {
      const payloadRecord = payload as Record<string, unknown>;
      const type = typeof payloadRecord.type === 'string' ? payloadRecord.type : '';
      const requestId = toStringValue(payloadRecord.requestId);
      const traceId = toStringValue(payloadRecord.traceId);

      if (type === 'STATUS_SYNC' && typeof (payload as Record<string, unknown>).status === 'string') {
        onStatusSync((payloadRecord.status as PresencePreferenceStatus), requestId || null, traceId || null);
      }
      if (type === 'STATUS_SYNC_ERROR') {
        const errorType = toStringValue(payloadRecord.errorType);
        const message = toStringValue(payloadRecord.message);
        onStatusSyncError(
          errorType || 'UNKNOWN_ERROR',
          message || 'Sync status failed',
          requestId || null,
          traceId || null
        );
      }
      if (type === 'RATE_LIMIT_ERROR') {
        onRateLimit(Number((payload as Record<string, unknown>).retryAfterSeconds) || 0, requestId || null, traceId || null);
      }
    });
  },

  subscribeToPresenceBatch(
    onPresenceBatch: (events: ReturnType<typeof normalizePresenceBatchPayload>) => void
  ): void {
    subscribe(PRESENCE_BATCH_QUEUE, (payload) => {
      const events = normalizePresenceBatchPayload(payload);
      if (events.length === 0) {
        return;
      }
      onPresenceBatch(events);
    });
  },

  sendPresenceBatch(userIds: string[]): void {
    const uniqueUserIds = toStringArray(userIds);
    if (uniqueUserIds.length > 0) {
      send('/app/presence.batch', {
        userIds: uniqueUserIds,
        requestId: generateTraceId(),
        traceId: generateTraceId(),
      });
    }
  },

  sendHeartbeat(): void {
    if (!isWebSocketReady()) {
      return;
    }
    send('/app/heartbeat', {
      deviceInfo: resolveDeviceInfo(),
      requestId: generateTraceId(),
      traceId: generateTraceId(),
    });
  },

  setStatus(status: PresencePreferenceStatus): PresenceSyncResult {
    const requestId = generateTraceId();
    const traceId = generateTraceId();
    send('/app/online-status', { status, requestId, traceId });
    return { requestId, traceId };
  },

  startHeartbeat(intervalMs: number): void {
    if (heartbeatTimer) {
      return;
    }

    const heartbeat = () => {
      presenceWsService.sendHeartbeat();
    };

    heartbeat();
    heartbeatTimer = setInterval(heartbeat, intervalMs);
  },

  stopHeartbeat(): void {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  },

  sendLogout(): void {
    if (isWebSocketReady()) {
      send('/app/presence/logout', {});
    }
  },

  shutdownPresenceSystem(): void {
    this.stopHeartbeat();
    unsubscribe(PRESENCE_QUEUE);
    unsubscribe(PRESENCE_SYNC_QUEUE);
    unsubscribe(PRESENCE_BATCH_QUEUE);
  },
};
