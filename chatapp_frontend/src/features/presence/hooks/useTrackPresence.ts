import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { presenceTracker } from '@/features/presence/services/presenceTracker';

/**
 * Track presence for a list of user IDs.
 * Components render a list of users and pass the currently visible IDs.
 * The hook manages:
 * - watch on mount / added IDs
 * - unwatch on unmount / removed IDs
 * - deduplication and stable dependency handling
 */
export function useTrackPresence(userIds: string[], conversationId: string | null = null): void {
  const serialized = useMemo(() => {
    const unique = [...new Set(userIds.filter(Boolean))];
    unique.sort();
    return unique.join(',');
  }, [userIds]);

  const prevRef = useRef<{ serialized: string; conversationId: string | null }>({
    serialized: '',
    conversationId: null,
  });

  useEffect(() => {
    const previous = prevRef.current;
    prevRef.current = { serialized, conversationId };
    const prev = previous.serialized;

    const nextSet = new Set(serialized ? serialized.split(',') : []);
    const prevSet = new Set(prev ? prev.split(',') : []);

    const toWatch: string[] = [];
    for (const id of nextSet) {
      if (previous.conversationId !== conversationId || !prevSet.has(id)) {
        toWatch.push(id);
      }
    }

    const toUnwatch: string[] = [];
    for (const id of prevSet) {
      if (previous.conversationId !== conversationId || !nextSet.has(id)) {
        toUnwatch.push(id);
      }
    }

    if (toWatch.length) {
      presenceTracker.watch(toWatch, conversationId);
    }
    if (toUnwatch.length) {
      presenceTracker.unwatch(toUnwatch, previous.conversationId);
    }
  }, [conversationId, serialized]);

  useEffect(() => {
    return () => {
      const current = prevRef.current.serialized ? prevRef.current.serialized.split(',') : [];
      if (current.length) {
        presenceTracker.unwatch(current, prevRef.current.conversationId);
      }
    };
  }, []);
}

export function useTrackPresenceInViewport<TElement extends Element>(
  userIds: string[],
  conversationId: string | null = null,
) {
  const [element, setElement] = useState<TElement | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const serialized = useMemo(
    () => [...new Set(userIds.filter(Boolean))].sort().join(','),
    [userIds],
  );
  const trackedUserIds = useMemo(
    () => (isNearViewport && serialized ? serialized.split(',') : []),
    [isNearViewport, serialized],
  );

  useTrackPresence(trackedUserIds, conversationId);

  useEffect(() => {
    if (!element) {
      setIsNearViewport(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      { rootMargin: '160px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return useCallback((node: TElement | null) => setElement(node), []);
}
