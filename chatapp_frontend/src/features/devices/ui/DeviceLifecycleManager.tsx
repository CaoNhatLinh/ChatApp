'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { heartbeatWebDevice, isDeviceId, registerWebDevice } from '@/features/devices/api/device.api';
import { logger } from '@/shared/lib/logger';

const DEVICE_ID_STORAGE_KEY_PREFIX = 'novachat_device_id';
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

const getDeviceStorageKey = (userId: string) => `${DEVICE_ID_STORAGE_KEY_PREFIX}:${userId}`;

const getStoredDeviceId = (userId: string): string | null => {
  const value = window.localStorage.getItem(getDeviceStorageKey(userId));
  return value && isDeviceId(value) ? value : null;
};

const createStoredDeviceId = (userId: string): string => {
  const deviceId = crypto.randomUUID();
  window.localStorage.setItem(getDeviceStorageKey(userId), deviceId);
  return deviceId;
};

/** Registers a browser once, then heartbeats without reactivating an admin-revoked device. */
export function DeviceLifecycleManager(): null {
  const authenticatedUserId = useAuthStore((state) => (
    state.user?.userId && state.token ? state.user.userId : null
  ));

  useEffect(() => {
    if (!authenticatedUserId) return;

    let active = true;
    let heartbeatHandle: number | null = null;
    let deviceId: string | null = null;

    const start = async () => {
      try {
        deviceId = getStoredDeviceId(authenticatedUserId);
        if (!deviceId) {
          deviceId = createStoredDeviceId(authenticatedUserId);
          await registerWebDevice({
            deviceId,
            platform: 'WEB',
            pushProvider: 'WEB_PUSH',
            deviceName: 'Nối Web',
          });
        } else {
          await heartbeatWebDevice(deviceId);
        }

        if (!active || !deviceId) return;
        heartbeatHandle = window.setInterval(() => {
          void heartbeatWebDevice(deviceId as string).catch((error) => {
            logger.warn('[DeviceLifecycle] heartbeat failed', error instanceof Error ? error.message : String(error));
          });
        }, HEARTBEAT_INTERVAL_MS);
      } catch (error) {
        logger.warn('[DeviceLifecycle] device sync failed', error instanceof Error ? error.message : String(error));
      }
    };

    void start();
    return () => {
      active = false;
      if (heartbeatHandle !== null) window.clearInterval(heartbeatHandle);
    };
  }, [authenticatedUserId]);

  return null;
}

export default DeviceLifecycleManager;
