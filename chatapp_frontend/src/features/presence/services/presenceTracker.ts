import { presenceWsService } from '@/features/presence/services/presenceWsService';

const referenceCounts = new Map<string, number>();
const userReferenceCounts = new Map<string, number>();

const scopeKey = (conversationId: string | null): string => conversationId ?? 'friends';
const trackingKey = (conversationId: string | null, userId: string): string => `${scopeKey(conversationId)}:${userId}`;

function normalize(userIds: string[]): string[] {
  return [...new Set(userIds.filter(Boolean))];
}

function subscribe(userIds: string[], conversationId: string | null): void {
  if (userIds.length === 0) return;
  presenceWsService.subscribeToUserPresence(userIds, conversationId);
}

export const presenceTracker = {
  watch(userIds: string[], conversationId: string | null): void {
    const newlyTracked: string[] = [];
    for (const userId of normalize(userIds)) {
      const key = trackingKey(conversationId, userId);
      referenceCounts.set(key, (referenceCounts.get(key) ?? 0) + 1);
      const nextUserCount = (userReferenceCounts.get(userId) ?? 0) + 1;
      userReferenceCounts.set(userId, nextUserCount);
      if (nextUserCount === 1) newlyTracked.push(userId);
    }
    subscribe(newlyTracked, conversationId);
  },

  unwatch(userIds: string[], conversationId: string | null): void {
    const noLongerTracked: string[] = [];
    for (const userId of normalize(userIds)) {
      const key = trackingKey(conversationId, userId);
      const currentScopeCount = referenceCounts.get(key) ?? 0;
      const nextCount = Math.max(0, currentScopeCount - 1);
      if (nextCount === 0) referenceCounts.delete(key);
      else referenceCounts.set(key, nextCount);

      const nextUserCount = Math.max(0, (userReferenceCounts.get(userId) ?? 0) - (currentScopeCount > 0 ? 1 : 0));
      if (nextUserCount === 0) {
        userReferenceCounts.delete(userId);
        noLongerTracked.push(userId);
      } else {
        userReferenceCounts.set(userId, nextUserCount);
      }
    }
    presenceWsService.unsubscribeFromUserPresence(noLongerTracked, conversationId);
  },

  resync(): void {
    const usersByScope = new Map<string, { conversationId: string | null; userIds: string[] }>();
    for (const [key, count] of referenceCounts.entries()) {
      if (count <= 0) continue;
      const separatorIndex = key.lastIndexOf(':');
      const rawScope = key.slice(0, separatorIndex);
      const userId = key.slice(separatorIndex + 1);
      const conversationId = rawScope === 'friends' ? null : rawScope;
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
    for (const key of referenceCounts.keys()) {
      const separatorIndex = key.lastIndexOf(':');
      const rawScope = key.slice(0, separatorIndex);
      const conversationId = rawScope === 'friends' ? null : rawScope;
      const groupKey = scopeKey(conversationId);
      const group = usersByScope.get(groupKey) ?? { conversationId, userIds: [] };
      group.userIds.push(key.slice(separatorIndex + 1));
      usersByScope.set(groupKey, group);
    }
    referenceCounts.clear();
    userReferenceCounts.clear();
    for (const group of usersByScope.values()) {
      presenceWsService.unsubscribeFromUserPresence(normalize(group.userIds), group.conversationId);
    }
  },
};
