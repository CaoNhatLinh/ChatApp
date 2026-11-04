import { useCallback, useEffect, useRef, useState } from 'react';
import { getMessageThread, type MessageKey, type MessageThreadPage } from '../api/thread.api';
import type { BackendMessage } from '../api/messenger.api';
import { realtimeService } from '@/shared/websocket/realtime-service';

type ThreadError = 'load' | 'forbidden' | 'missing';
interface ThreadState {
  page?: MessageThreadPage;
  loading: boolean;
  error?: ThreadError;
  updates: boolean;
}

/** Mount under an actor/room/full-parent key; no content survives a scope change. */
export function useMessageThread(scope: MessageKey) {
  const { conversationId, messageId, messageBucket } = scope;
  const [state, setState] = useState<ThreadState>({ loading: true, updates: false });
  const stateRef = useRef(state); stateRef.current = state;
  const request = useRef<AbortController | null>(null);
  const seen = useRef(new Set<string>());
  const failedCursor = useRef<string | null>(null);

  const load = useCallback(async (cursor: string | null) => {
    if (cursor && request.current) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    if (!cursor) seen.current.clear();
    failedCursor.current = cursor;
    setState(previous => ({ page: cursor ? previous.page : undefined, loading: true, updates: false }));
    try {
      const page = await getMessageThread({ conversationId, messageId, messageBucket }, { cursor, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (page.nextCursor && seen.current.has(page.nextCursor)) throw new Error('Repeated thread cursor');
      if (cursor) seen.current.add(cursor);
      setState(previous => ({ loading: false, updates: previous.updates, page: {
        ...page, content: [...new Map([...(cursor ? previous.page?.content ?? [] : []), ...page.content].map(row => [row.messageId, row])).values()],
      } }));
    } catch (error) {
      if (controller.signal.aborted) return;
      const status = (error as { response?: { status?: number } })?.response?.status;
      const kind = status === 401 || status === 403 ? 'forbidden' : status === 404 ? 'missing' : 'load';
      setState(previous => ({ page: kind === 'load' && cursor ? previous.page : undefined,
        loading: false, updates: false, error: kind }));
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [conversationId, messageId, messageBucket]);

  const reload = useCallback(() => { void load(null); }, [load]);
  useEffect(() => {
    reload();
    const focus = () => reload();
    window.addEventListener('focus', focus);
    const unsubscribe = realtimeService.subscribe<BackendMessage>(`/topic/conversation/${conversationId}`, event => {
      if (event.conversationId !== conversationId) return;
      if (event.messageId === messageId || stateRef.current.page?.content.some(row => row.messageId === event.messageId)) reload();
      else if (event.replyToMessageId === messageId && event.replyToMessageBucket === messageBucket) {
        setState(previous => ({ ...previous, updates: true }));
      }
    });
    return () => { request.current?.abort(); window.removeEventListener('focus', focus); unsubscribe(); };
  }, [conversationId, messageId, messageBucket, reload]);

  return { ...state, reload,
    retry: () => { void load(state.error === 'load' ? failedCursor.current : null); },
    loadMore: () => { const page = stateRef.current.page; if (page?.hasNext && page.nextCursor) void load(page.nextCursor); },
  };
}
