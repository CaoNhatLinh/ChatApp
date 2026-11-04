import { useCallback, useEffect, useRef, useState } from 'react';
import { getConversations, type ConversationFilter } from '../api/messenger.api';
import type { Conversation } from '../types/messenger.types';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { localizeText } from '@/shared/i18n';
import { reconcileConversationPage } from './conversation-directory';

interface DirectoryState {
  key: string;
  content: Conversation[];
  cursor: string | null;
  hasNext: boolean;
  loading: boolean;
  error: string | null;
}
const empty = (key: string): DirectoryState => ({ key, content: [], cursor: null, hasNext: false, loading: true, error: null });

export const useConversationDirectory = (query: string, filter: ConversationFilter, enabled = true) => {
  const actor = useAuthStore(state => state.user?.userId);
  const q = query.trim();
  const key = JSON.stringify([actor, q, filter, enabled]);
  const [state, setState] = useState<DirectoryState>(() => empty(key));
  const pending = useRef<AbortController | null>(null);
  const failed = useRef<{ cursor: string | null; append: boolean }>({ cursor: null, append: false });

  const load = useCallback(async (cursor: string | null, append: boolean) => {
    if (!enabled || !actor || pending.current) return;
    const request = new AbortController();
    pending.current = request;
    failed.current = { cursor, append };
    setState(previous => ({ ...(previous.key === key ? previous : empty(key)), loading: true, error: null }));
    try {
      const page = await getConversations(30, cursor, { query: q, filter, signal: request.signal });
      if (request.signal.aborted) return;
      if (page.hasNext && (!page.nextCursor || page.nextCursor === cursor)) throw new Error('Invalid directory continuation');
      setState(previous => ({ key, loading: false, error: null, cursor: page.nextCursor ?? null, hasNext: page.hasNext,
        content: reconcileConversationPage(previous.key === key ? previous.content : [], page.content, append),
      }));
    } catch (error) {
      if (!request.signal.aborted) setState(previous => ({ ...previous, key, loading: false,
        error: getUserFacingErrorMessage(error, localizeText('Không tải được cuộc trò chuyện. Hãy thử lại.')) }));
    } finally {
      if (pending.current === request) pending.current = null;
    }
  }, [actor, enabled, filter, key, q]);

  useEffect(() => {
    pending.current?.abort();
    pending.current = null;
    setState(empty(key));
    const timer = setTimeout(() => { void load(null, false); }, q ? 250 : 0);
    return () => { clearTimeout(timer); pending.current?.abort(); pending.current = null; };
  }, [key, load, q]);

  const current = state.key === key ? state : empty(key);
  return { ...current,
    loadMore: () => current.hasNext && !current.loading ? load(current.cursor, true) : Promise.resolve(),
    retry: () => load(failed.current.cursor, failed.current.append),
    reload: () => load(null, false),
  };
};
