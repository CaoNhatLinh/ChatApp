// src/features/presence/hooks/useTrackPresence.ts
// React hook for visibility-based presence tracking.
// Parent components (lists) call this with the user IDs currently visible.
// On mount → watch, on unmount → unwatch, on deps change → diff.

import { useEffect, useMemo, useRef } from 'react';
import { presenceTracker } from '@/features/presence/services/presenceTracker';

/**
 * Track presence for a list of user IDs.
 * Components that render a list of users should call this hook with the
 * currently visible user IDs. The hook handles:
 *  - watch on mount / new IDs
 *  - unwatch on unmount / removed IDs
 *  - deduplication and stable identity via sorted serialization
 *
 * @example
 * ```tsx
 * // In a parent list component:
 * const dmUserIds = conversations
 *   .filter(c => c.type === 'dm' && c.otherParticipant)
 *   .map(c => c.otherParticipant!.userId);
 * useTrackPresence(dmUserIds);
 * ```
 */
export function useTrackPresence(userIds: string[]): void {
  // Stable serialized key — only triggers effect when the actual set of IDs changes
  const serialized = useMemo(() => {
    const unique = [...new Set(userIds.filter(Boolean))];
    unique.sort();
    return unique.join(',');
  }, [userIds]);

  // Track previous serialized value to compute diffs
  const prevRef = useRef<string>('');

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = serialized;

    const nextSet = new Set(serialized ? serialized.split(',') : []);
    const prevSet = new Set(prev ? prev.split(',') : []);

    // IDs added (in next but not prev)
    const toWatch: string[] = [];
    for (const id of nextSet) {
      if (!prevSet.has(id)) toWatch.push(id);
    }

    // IDs removed (in prev but not next)
    const toUnwatch: string[] = [];
    for (const id of prevSet) {
      if (!nextSet.has(id)) toUnwatch.push(id);
    }

    if (toWatch.length) presenceTracker.watch(toWatch);
    if (toUnwatch.length) presenceTracker.unwatch(toUnwatch);
  }, [serialized]);

  // Handle final unmount cleanup separately to avoid interference with diffing
  useEffect(() => {
    return () => {
      const current = prevRef.current ? prevRef.current.split(',') : [];
      if (current.length) presenceTracker.unwatch(current);
    };
  }, []);
}
