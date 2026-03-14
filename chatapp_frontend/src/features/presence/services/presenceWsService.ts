// WebSocket service for presence - manages presence subscriptions and heartbeats
export const presenceWsService = {
  subscribeToUserPresence: (_userIds: string[]) => {},
  requestBatchPresence: (_userIds: string[]) => {},
  subscribeToPresenceEvents: () => {},
  subscribeToPresenceSync: (_onStatusSync: (status: string) => void, _onRateLimit: (retryAfter: number) => void) => {},
  setStatus: (_status: 'ONLINE' | 'DND' | 'INVISIBLE') => {},
  startHeartbeat: (_intervalMs: number) => {},
  stopHeartbeat: () => {},
  sendLogout: () => {},
  shutdownPresenceSystem: () => {},
};
