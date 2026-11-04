import { useCallback, useEffect, useRef, useState } from 'react';
import { giphyClient, giphyWebKey } from '../api/giphy.client';
import { GiphyError, type GiphyErrorCode, type GiphyGif } from '../api/giphy.api';

interface SearchPage { scope: string; items: GiphyGif[]; nextOffset: number | null; loading: boolean; error: GiphyErrorCode | null }

export function useGiphySearch(query: string, locale: 'vi' | 'en') {
  const scope = JSON.stringify([query, locale]);
  const [page, setPage] = useState<SearchPage>({ scope, items: [], nextOffset: null, loading: true, error: null });
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const failedOffset = useRef(0);

  const load = useCallback(async (offset: number, signal: AbortSignal) => {
    if (busy.current || !giphyWebKey) return;
    busy.current = true;
    failedOffset.current = offset;
    setPage(previous => ({ ...previous, loading: true, error: null }));
    try {
      const result = await giphyClient.list({ query, offset, locale, signal });
      if (signal.aborted) return;
      if (result.nextOffset !== null && result.nextOffset <= offset) throw new GiphyError('INVALID_RESPONSE');
      setPage(previous => ({ scope, items: offset > 0 && previous.scope === scope ? [...previous.items, ...result.content] : result.content,
        nextOffset: result.nextOffset, loading: false, error: null }));
    } catch (error: unknown) {
      if (!signal.aborted) setPage(previous => ({ ...previous, loading: false, error: error instanceof GiphyError ? error.code : 'UNAVAILABLE' }));
    } finally { if (!signal.aborted) busy.current = false; }
  }, [query, locale, scope]);

  useEffect(() => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request; busy.current = false;
    setPage({ scope, items: [], nextOffset: null, loading: Boolean(giphyWebKey), error: giphyWebKey ? null : 'UNCONFIGURED' });
    if (giphyWebKey) void load(0, request.signal);
    return () => request.abort();
  }, [load, scope]);

  const current = page.scope === scope ? page : { scope, items: [], nextOffset: null, loading: true, error: null };
  return { ...current,
    retry: () => { if (controller.current) void load(failedOffset.current, controller.current.signal); },
    loadMore: () => { if (current.nextOffset !== null && controller.current) void load(current.nextOffset, controller.current.signal); },
  };
}
