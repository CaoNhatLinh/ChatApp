import { presenceWsService } from '@/features/presence/services/presenceWsService';

const referenceCounts = new Map<string, number>();

function normalize(userIds: string[]): string[] {
  return [...new Set(userIds.filter(Boolean))];
}

function isTracked(userId: string): boolean {
  return (referenceCounts.get(userId) ?? 0) > 0;
}

function subscribe(userIds: string[]): void {
  if (userIds.length === 0) return;
  presenceWsService.subscribeToUserPresence(userIds);
}

export const presenceTracker = {
  watch(userIds: string[]): void {
    const newlyTracked: string[] = [];
    for (const userId of normalize(userIds)) {
      const wasTracked = isTracked(userId);
      referenceCounts.set(userId, (referenceCounts.get(userId) ?? 0) + 1);
      if (!wasTracked) newlyTracked.push(userId);
    }
    subscribe(newlyTracked);
  },

  unwatch(userIds: string[]): void {
    const noLongerTracked: string[] = [];
    for (const userId of normalize(userIds)) {
      const nextCount = Math.max(0, (referenceCounts.get(userId) ?? 0) - 1);
      if (nextCount === 0) referenceCounts.delete(userId);
      else referenceCounts.set(userId, nextCount);

      if (!isTracked(userId)) noLongerTracked.push(userId);
    }
    presenceWsService.unsubscribeFromUserPresence(noLongerTracked);
  },

  resync(): void {
    const trackedUsers = [...referenceCounts.keys()];
    if (trackedUsers.length === 0) {
      return;
    }

    subscribe(trackedUsers);
    presenceWsService.sendPresenceBatch(trackedUsers);
  },

  clear(): void {
    const userIds = [...referenceCounts.keys()];
    referenceCounts.clear();
    presenceWsService.unsubscribeFromUserPresence(userIds);
  },
};
