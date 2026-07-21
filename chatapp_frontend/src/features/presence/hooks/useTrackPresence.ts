import { useEffect, useMemo, useRef } from 'react';
import { presenceTracker } from '@/features/presence/services/presenceTracker';

/**
 * Track presence for a list of user IDs.
 * Components render a list of users and pass the currently visible IDs.
 * The hook manages:
 * - watch on mount / added IDs
 * - unwatch on unmount / removed IDs
 * - deduplication and stable dependency handling
 */
export function useTrackPresence(userIds: string[]): void {
  const serialized = useMemo(() => {
    const unique = [...new Set(userIds.filter(Boolean))];
    unique.sort();
    return unique.join(',');
  }, [userIds]);

  const prevRef = useRef<string>('');

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = serialized;

    const nextSet = new Set(serialized ? serialized.split(',') : []);
    const prevSet = new Set(prev ? prev.split(',') : []);

    const toWatch: string[] = [];
    for (const id of nextSet) {
      if (!prevSet.has(id)) {
        toWatch.push(id);
      }
    }

    const toUnwatch: string[] = [];
    for (const id of prevSet) {
      if (!nextSet.has(id)) {
        toUnwatch.push(id);
      }
    }

    if (toWatch.length) {
      presenceTracker.watch(toWatch);
    }
    if (toUnwatch.length) {
      presenceTracker.unwatch(toUnwatch);
    }
  }, [serialized]);

  useEffect(() => {
    return () => {
      const current = prevRef.current ? prevRef.current.split(',') : [];
      if (current.length) {
        presenceTracker.unwatch(current);
      }
    };
  }, []);
}
