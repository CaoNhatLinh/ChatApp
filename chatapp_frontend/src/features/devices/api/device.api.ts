import apiClient from '@/shared/api/apiClient';

export type DevicePlatform = 'WEB' | 'IOS' | 'ANDROID';
export type PushProvider = 'FCM' | 'APNS' | 'WEB_PUSH';

export interface DeviceRegistrationRequest {
  deviceId: string;
  platform: DevicePlatform;
  pushProvider: PushProvider;
  pushToken?: string;
  deviceName?: string;
  appVersion?: string;
}

export interface DeviceSession {
  deviceId: string;
  platform: DevicePlatform;
  pushProvider: PushProvider;
  deviceName: string | null;
  appVersion: string | null;
  active: boolean;
  createdAt: string;
  lastSeenAt: string;
}

const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLATFORMS = new Set<DevicePlatform>(['WEB', 'IOS', 'ANDROID']);
const PUSH_PROVIDERS = new Set<PushProvider>(['FCM', 'APNS', 'WEB_PUSH']);

export const isDeviceId = (value: string): boolean => DEVICE_ID_PATTERN.test(value);

const parseDeviceSession = (value: unknown): DeviceSession => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid device response');
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.deviceId !== 'string' || !isDeviceId(candidate.deviceId)
    || typeof candidate.platform !== 'string' || !PLATFORMS.has(candidate.platform as DevicePlatform)
    || typeof candidate.pushProvider !== 'string' || !PUSH_PROVIDERS.has(candidate.pushProvider as PushProvider)
    || (candidate.deviceName !== null && typeof candidate.deviceName !== 'string')
    || (candidate.appVersion !== null && typeof candidate.appVersion !== 'string')
    || typeof candidate.active !== 'boolean'
    || typeof candidate.createdAt !== 'string'
    || typeof candidate.lastSeenAt !== 'string') {
    throw new Error('Invalid device response');
  }
  return {
    deviceId: candidate.deviceId,
    platform: candidate.platform as DevicePlatform,
    pushProvider: candidate.pushProvider as PushProvider,
    deviceName: candidate.deviceName,
    appVersion: candidate.appVersion,
    active: candidate.active,
    createdAt: candidate.createdAt,
    lastSeenAt: candidate.lastSeenAt,
  };
};

export const registerWebDevice = async (request: DeviceRegistrationRequest): Promise<DeviceSession> => {
  if (!isDeviceId(request.deviceId) || request.platform !== 'WEB' || request.pushProvider !== 'WEB_PUSH') {
    throw new Error('Invalid web device registration');
  }
  const response = await apiClient.post('/devices', request);
  return parseDeviceSession(response.data);
};

export const heartbeatWebDevice = async (deviceId: string): Promise<void> => {
  if (!isDeviceId(deviceId)) {
    throw new Error('Invalid device id');
  }
  await apiClient.post(`/devices/${deviceId}/heartbeat`);
};
