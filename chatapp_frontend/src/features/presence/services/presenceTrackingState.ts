export interface PresenceTrackingTransport {
  subscribe: (userIds: string[], conversationId: string | null) => void;
  unsubscribe: (userIds: string[], conversationId: string | null) => void;
  sendBatch: (userIds: string[], conversationId: string | null) => void;
  clearPresence: (userId: string) => void;
}

export interface PresenceTrackingController {
  watch: (userIds: string[], conversationId: string | null) => void;
  unwatch: (userIds: string[], conversationId: string | null) => void;
  resync: () => void;
  clear: () => void;
}

const FRIENDS_SCOPE = 'friends';

const normalize = (userIds: string[]): string[] => [...new Set(userIds.filter(Boolean))];
const scopeKey = (conversationId: string | null): string => conversationId ?? FRIENDS_SCOPE;
const conversationIdFromScope = (scope: string): string | null => scope === FRIENDS_SCOPE ? null : scope;
const trackingKey = (scope: string, userId: string): string => `${scope}:${userId}`;

const addToScope = (groups: Map<string, string[]>, scope: string, userId: string): void => {
  const users = groups.get(scope) ?? [];
  users.push(userId);
  groups.set(scope, users);
};

export function createPresenceTrackingController(
  transport: PresenceTrackingTransport,
): PresenceTrackingController {
  const referenceCounts = new Map<string, number>();
  const activeScopeByUser = new Map<string, string>();

  const findTrackedScope = (userId: string): string | null => {
    const suffix = `:${userId}`;
    for (const [key, count] of referenceCounts.entries()) {
      if (count > 0 && key.endsWith(suffix)) return key.slice(0, -suffix.length);
    }
    return null;
  };

  const activeGroups = (): Map<string, string[]> => {
    const groups = new Map<string, string[]>();
    for (const [userId, scope] of activeScopeByUser.entries()) addToScope(groups, scope, userId);
    return groups;
  };

  return {
    watch(userIds, conversationId) {
      const scope = scopeKey(conversationId);
      const newlyTracked: string[] = [];
      for (const userId of normalize(userIds)) {
        const key = trackingKey(scope, userId);
        referenceCounts.set(key, (referenceCounts.get(key) ?? 0) + 1);
        if (!activeScopeByUser.has(userId)) {
          activeScopeByUser.set(userId, scope);
          newlyTracked.push(userId);
        }
      }
      if (newlyTracked.length > 0) transport.subscribe(newlyTracked, conversationId);
    },

    unwatch(userIds, conversationId) {
      const scope = scopeKey(conversationId);
      const unsubscribes = new Map<string, string[]>();
      const subscribes = new Map<string, string[]>();
      const clearUserIds: string[] = [];

      for (const userId of normalize(userIds)) {
        const key = trackingKey(scope, userId);
        const currentCount = referenceCounts.get(key) ?? 0;
        const nextCount = Math.max(0, currentCount - 1);
        if (nextCount === 0) referenceCounts.delete(key);
        else referenceCounts.set(key, nextCount);

        if (currentCount === 0 || nextCount > 0 || activeScopeByUser.get(userId) !== scope) continue;

        addToScope(unsubscribes, scope, userId);
        clearUserIds.push(userId);
        const nextScope = findTrackedScope(userId);
        if (nextScope) {
          activeScopeByUser.set(userId, nextScope);
          addToScope(subscribes, nextScope, userId);
        } else {
          activeScopeByUser.delete(userId);
        }
      }

      for (const [trackedScope, users] of unsubscribes.entries()) {
        transport.unsubscribe(normalize(users), conversationIdFromScope(trackedScope));
      }
      for (const userId of clearUserIds) transport.clearPresence(userId);
      for (const [trackedScope, users] of subscribes.entries()) {
        transport.subscribe(normalize(users), conversationIdFromScope(trackedScope));
      }
    },

    resync() {
      for (const [scope, users] of activeGroups().entries()) {
        const normalizedUsers = normalize(users);
        const conversationId = conversationIdFromScope(scope);
        transport.subscribe(normalizedUsers, conversationId);
        transport.sendBatch(normalizedUsers, conversationId);
      }
    },

    clear() {
      const groups = activeGroups();
      referenceCounts.clear();
      activeScopeByUser.clear();
      for (const [scope, users] of groups.entries()) {
        transport.unsubscribe(normalize(users), conversationIdFromScope(scope));
      }
    },
  };
}
