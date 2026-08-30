export interface PresenceCommandTransport {
  subscribe: (userIds: string[], conversationId: string | null) => void;
  unsubscribe: (userIds: string[], conversationId: string | null) => void;
  sendBatch: (userIds: string[], conversationId: string | null) => void;
  clearPresence: (userId: string) => void;
}

interface PendingScopeCommands {
  conversationId: string | null;
  subscriptions: Set<string>;
  unsubscriptions: Set<string>;
}

interface PresenceCommandBatcherOptions {
  transport: PresenceCommandTransport;
  delayMs?: number;
  scheduleFlush?: (callback: () => void, delayMs: number) => unknown;
  cancelScheduledFlush?: (handle: unknown) => void;
}

const FRIENDS_SCOPE = 'friends';

const scopeKey = (conversationId: string | null): string => conversationId ?? FRIENDS_SCOPE;
const uniqueUserIds = (userIds: string[]): string[] => [...new Set(userIds.filter(Boolean))];

export function createPresenceCommandBatcher({
  transport,
  delayMs = 50,
  scheduleFlush = (callback, delay) => setTimeout(callback, delay),
  cancelScheduledFlush = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: PresenceCommandBatcherOptions): PresenceCommandTransport & { flush: () => void } {
  const deliveredSubscriptions = new Map<string, Set<string>>();
  const pendingCommands = new Map<string, PendingScopeCommands>();
  let scheduledFlush: unknown = null;

  const getDeliveredSubscriptions = (scope: string): Set<string> => {
    return deliveredSubscriptions.get(scope) ?? new Set<string>();
  };

  const getPendingCommands = (conversationId: string | null): PendingScopeCommands => {
    const scope = scopeKey(conversationId);
    const pending = pendingCommands.get(scope) ?? {
      conversationId,
      subscriptions: new Set<string>(),
      unsubscriptions: new Set<string>(),
    };
    pendingCommands.set(scope, pending);
    return pending;
  };

  const flush = (): void => {
    if (scheduledFlush !== null) {
      cancelScheduledFlush(scheduledFlush);
      scheduledFlush = null;
    }

    for (const [scope, pending] of pendingCommands.entries()) {
      const delivered = getDeliveredSubscriptions(scope);
      const subscriptions = [...pending.subscriptions];
      const unsubscriptions = [...pending.unsubscriptions];
      if (subscriptions.length > 0) {
        transport.subscribe(subscriptions, pending.conversationId);
        subscriptions.forEach((userId) => delivered.add(userId));
      }
      if (unsubscriptions.length > 0) {
        transport.unsubscribe(unsubscriptions, pending.conversationId);
        unsubscriptions.forEach((userId) => delivered.delete(userId));
      }
      if (delivered.size > 0) deliveredSubscriptions.set(scope, delivered);
      else deliveredSubscriptions.delete(scope);
    }
    pendingCommands.clear();
  };

  const schedule = (): void => {
    if (scheduledFlush !== null) return;
    scheduledFlush = scheduleFlush(() => {
      scheduledFlush = null;
      flush();
    }, delayMs);
  };

  return {
    subscribe(userIds, conversationId) {
      const scope = scopeKey(conversationId);
      const delivered = getDeliveredSubscriptions(scope);
      const pending = getPendingCommands(conversationId);
      for (const userId of uniqueUserIds(userIds)) {
        if (pending.unsubscriptions.delete(userId)) continue;
        if (!delivered.has(userId)) pending.subscriptions.add(userId);
      }
      if (pending.subscriptions.size > 0 || pending.unsubscriptions.size > 0) schedule();
      else pendingCommands.delete(scope);
    },

    unsubscribe(userIds, conversationId) {
      const scope = scopeKey(conversationId);
      const delivered = getDeliveredSubscriptions(scope);
      const pending = getPendingCommands(conversationId);
      for (const userId of uniqueUserIds(userIds)) {
        if (pending.subscriptions.delete(userId)) continue;
        if (delivered.has(userId)) pending.unsubscriptions.add(userId);
      }
      if (pending.subscriptions.size > 0 || pending.unsubscriptions.size > 0) schedule();
      else pendingCommands.delete(scope);
    },

    sendBatch(userIds, conversationId) {
      flush();
      transport.sendBatch(uniqueUserIds(userIds), conversationId);
    },

    clearPresence(userId) {
      transport.clearPresence(userId);
    },

    flush,
  };
}
