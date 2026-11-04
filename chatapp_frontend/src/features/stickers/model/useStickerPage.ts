import { useCallback, useEffect, useRef, useState } from 'react';
import type { StickerPage } from '../api/stickers.api';

export function useStickerPage<T>(
  fetchPage: (cursor?: string, signal?: AbortSignal) => Promise<StickerPage<T>>,
  getId: (item: T) => string,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const failedCursor = useRef<string | undefined>(undefined);
  const seenCursors = useRef(new Set<string>());

  const load = useCallback(async (cursor?: string) => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    failedCursor.current = cursor;
    setLoading(true);
    setError(false);
    try {
      const page = await fetchPage(cursor, request.signal);
      if (request.signal.aborted) return;
      if (page.hasNext && (!page.nextCursor || page.nextCursor === cursor || seenCursors.current.has(page.nextCursor))) {
        throw new Error('Invalid sticker cursor');
      }
      if (page.hasNext && page.nextCursor) seenCursors.current.add(page.nextCursor);
      setItems(previous => {
        const merged = cursor ? [...previous, ...page.content] : page.content;
        return [...new Map(merged.map(item => [getId(item), item])).values()];
      });
      setNextCursor(page.hasNext ? page.nextCursor : null);
    } catch {
      if (!request.signal.aborted) setError(true);
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, [fetchPage, getId]);

  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    seenCursors.current.clear();
    void load();
    return () => controller.current?.abort();
  }, [load]);

  return {
    items, loading, error, hasNext: Boolean(nextCursor),
    retry: () => void load(failedCursor.current),
    loadMore: () => { if (nextCursor && !loading) void load(nextCursor); },
  };
}
