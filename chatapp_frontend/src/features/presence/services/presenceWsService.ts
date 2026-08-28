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
    online: boolean;
    status: string;
    lastSeen: string | null;
    device: string | null;
    lastActiveAgo: string | null;
    timestamp: string;
}

export type PresenceSyncResult = {
    requestId: string;
    traceId: string;
};

function toStringArray(userIds: string[]): string[] {
  return [...new Set(userIds.filter(Boolean))];
}

function generateTraceId(): string {
    if (typeof globalThis.crypto?.randomUUID !== 'function') {
        throw new Error('Web Crypto randomUUID is required for presence correlation');
    }
    return globalThis.crypto.randomUUID();
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

function toNullableString(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error('Presence correlation fields must be non-empty strings or null');
    }
    return value;
}

function normalizePresenceBatchPayload(payload: unknown) {
    if (!payload || typeof payload !== 'object') {
        return [];
    }

    return Object.entries(payload as Record<string, unknown>).map(([userId, raw]) => {
        if (typeof raw !== 'object' || raw === null) {
            throw new Error(`Presence batch entry ${userId} is invalid`);
        }
        const eventRecord = raw as RawPresenceBatchEntry;

        return normalizeOnlineStatusEvent({
            userId,
            online: eventRecord.online,
            status: normalizePresenceStatusValue(eventRecord.status) ?? (() => { throw new Error(`Presence batch entry ${userId} has invalid status`); })(),
            timestamp: eventRecord.timestamp,
            lastSeen: eventRecord.lastSeen,
            device: eventRecord.device,
            lastActiveAgo: eventRecord.lastActiveAgo,
            requestId: null,
            traceId: null,
        });
    }).map((item) => {
        if (!item) {
            throw new Error('Presence batch contains malformed event');
        }
        return item;
    });
}

function resolveDeviceInfo(): string {
  if (cachedDeviceInfo) {
    return cachedDeviceInfo;
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
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
                : null;

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
        : null;

  const deviceClass = hasMobileHint ? 'Mobile' : hasDesktopHint ? 'Desktop' : null;
  cachedDeviceInfo = deviceClass && os && browser ? `${deviceClass} • ${os} • ${browser}` : '';
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
    onStatusSyncError: (errorType: string, message: string, requestId: string | null, traceId: string | null) => void
  ): void {
    subscribe(PRESENCE_SYNC_QUEUE, (payload) => {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Presence sync payload must be an object');
      }
      const payloadRecord = payload as Record<string, unknown>;
      const type = payloadRecord.type;
      if (typeof type !== 'string') {
        throw new Error('Presence sync type is required');
      }
      const requestId = toNullableString(payloadRecord.requestId);
      const traceId = toNullableString(payloadRecord.traceId);

      if (type === 'STATUS_SYNC') {
        const status = normalizePresenceStatusValue(payloadRecord.status);
        if (!status || status === 'OFFLINE') {
          throw new Error('Presence status sync contains an invalid status');
        }
        onStatusSync(status, requestId, traceId);
      }
      if (type === 'STATUS_SYNC_ERROR') {
        if (typeof payloadRecord.errorType !== 'string' || !payloadRecord.errorType.trim()
          || typeof payloadRecord.message !== 'string' || !payloadRecord.message.trim()) {
          throw new Error('Presence status sync error is missing errorType or message');
        }
        onStatusSyncError(payloadRecord.errorType, payloadRecord.message, requestId, traceId);
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
      deviceInfo: resolveDeviceInfo() || null,
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
