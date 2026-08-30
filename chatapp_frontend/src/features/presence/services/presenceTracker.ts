import { presenceWsService } from '@/features/presence/services/presenceWsService';
import { usePresenceStore } from '@/features/presence/model/presence.store';

const referenceCounts = new Map<string, number>();
const activeScopeByUser = new Map<string, string>();

const scopeKey = (conversationId: string | null): string => conversationId ?? 'friends';
const trackingKey = (conversationId: string | null, userId: string): string => `${scopeKey(conversationId)}:${userId}`;

function normalize(userIds: string[]): string[] {
  return [...new Set(userIds.filter(Boolean))];
}

function subscribe(userIds: string[], conversationId: string | null): void {
  if (userIds.length === 0) return;
  presenceWsService.subscribeToUserPresence(userIds, conversationId);
}

function conversationIdFromScope(scope: string): string | null {
  return scope === 'friends' ? null : scope;
}

function findTrackedScope(userId: string): string | null {
  const suffix = `:${userId}`;
  for (const [key, count] of referenceCounts.entries()) {
    if (count > 0 && key.endsWith(suffix)) {
      return key.slice(0, -suffix.length);
    }
  }
  return null;
}

function groupUserByScope(
  groups: Map<string, string[]>,
  scope: string,
  userId: string,
): void {
  const users = groups.get(scope) ?? [];
  users.push(userId);
  groups.set(scope, users);
}

export const presenceTracker = {
  watch(userIds: string[], conversationId: string | null): void {
    const newlyTracked: string[] = [];
    const scope = scopeKey(conversationId);
    for (const userId of normalize(userIds)) {
      const key = trackingKey(conversationId, userId);
      referenceCounts.set(key, (referenceCounts.get(key) ?? 0) + 1);
      if (!activeScopeByUser.has(userId)) {
        activeScopeByUser.set(userId, scope);
        newlyTracked.push(userId);
      }
    }
    subscribe(newlyTracked, conversationId);
  },

  unwatch(userIds: string[], conversationId: string | null): void {
    const scope = scopeKey(conversationId);
    const unsubscribesByScope = new Map<string, string[]>();
    const subscribesByScope = new Map<string, string[]>();
    for (const userId of normalize(userIds)) {
      const key = trackingKey(conversationId, userId);
      const currentScopeCount = referenceCounts.get(key) ?? 0;
      const nextCount = Math.max(0, currentScopeCount - 1);
      if (nextCount === 0) referenceCounts.delete(key);
      else referenceCounts.set(key, nextCount);

      if (currentScopeCount === 0 || nextCount > 0 || activeScopeByUser.get(userId) !== scope) continue;

      groupUserByScope(unsubscribesByScope, scope, userId);
      usePresenceStore.getState().removePresence(userId);
      const nextScope = findTrackedScope(userId);
      if (nextScope) {
        activeScopeByUser.set(userId, nextScope);
        groupUserByScope(subscribesByScope, nextScope, userId);
      } else {
        activeScopeByUser.delete(userId);
      }
    }
    for (const [trackedScope, users] of unsubscribesByScope.entries()) {
      presenceWsService.unsubscribeFromUserPresence(normalize(users), conversationIdFromScope(trackedScope));
    }
    for (const [trackedScope, users] of subscribesByScope.entries()) {
      subscribe(normalize(users), conversationIdFromScope(trackedScope));
    }
  },

  resync(): void {
    const usersByScope = new Map<string, { conversationId: string | null; userIds: string[] }>();
    for (const [userId, rawScope] of activeScopeByUser.entries()) {
      const conversationId = conversationIdFromScope(rawScope);
      const groupKey = scopeKey(conversationId);
      const group = usersByScope.get(groupKey) ?? { conversationId, userIds: [] };
      group.userIds.push(userId);
      usersByScope.set(groupKey, group);
    }

    for (const group of usersByScope.values()) {
      const users = normalize(group.userIds);
      subscribe(users, group.conversationId);
      presenceWsService.sendPresenceBatch(users, group.conversationId);
    }
  },

  clear(): void {
    const usersByScope = new Map<string, { conversationId: string | null; userIds: string[] }>();
    for (const [userId, rawScope] of activeScopeByUser.entries()) {
      const conversationId = conversationIdFromScope(rawScope);
      const groupKey = scopeKey(conversationId);
      const group = usersByScope.get(groupKey) ?? { conversationId, userIds: [] };
      group.userIds.push(userId);
      usersByScope.set(groupKey, group);
    }
    referenceCounts.clear();
    activeScopeByUser.clear();
    for (const group of usersByScope.values()) {
      presenceWsService.unsubscribeFromUserPresence(normalize(group.userIds), group.conversationId);
    }
  },
};
