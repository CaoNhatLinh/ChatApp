import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { getSessionGeneration } from '@/shared/auth/access-token';
import { getCallHistory, getCallHistoryDetail, type CallHistoryQuery } from '../api/call-history.api';
import { CallHistoryReader, emptyHistoryReading, type CallHistoryReading } from '../model/call-history-reader';

export function useCallHistory(scope: CallHistoryQuery, generation: number) {
  const { actorId, conversationId, month } = scope;
  const key = `${actorId}/${generation}/${conversationId ?? 'own'}/${month}`;
  const [reading, setReading] = useState<{ key: string; value: CallHistoryReading } | null>(null);
  const active = useRef<{ key: string; reader: CallHistoryReader } | null>(null);
  useEffect(() => {
    let disposed = false;
    const current = () => {
      const auth = useAuthStore.getState();
      return !disposed && generation === getSessionGeneration() && auth.user?.userId === actorId
        && Boolean(auth.token) && !auth.loading && !auth.initializationError;
    };
    const reader = new CallHistoryReader({ actorId, conversationId, month }, { current,
      changed: value => { if (current()) setReading({ key, value }); }, list: getCallHistory, detail: getCallHistoryDetail });
    active.current = { key, reader };
    void reader.refresh();
    const onFocus = () => { void reader.reloadCurrent(); };
    window.addEventListener('focus', onFocus);
    return () => { disposed = true; reader.dispose(); active.current = null; window.removeEventListener('focus', onFocus); };
  }, [actorId, conversationId, generation, key, month]);
  const refresh = useCallback(() => { if (active.current?.key === key) void active.current.reader.refresh(); }, [key]);
  const retry = useCallback(() => { if (active.current?.key === key) void active.current.reader.reloadCurrent(); }, [key]);
  const back = useCallback(() => { if (active.current?.key === key) active.current.reader.back(); }, [key]);
  const loadMore = useCallback(() => { if (active.current?.key === key) void active.current.reader.loadMore(); }, [key]);
  const openDetail = useCallback((entry: { conversationId: string; callId: string }) => {
    if (active.current?.key === key) void active.current.reader.openDetail(entry);
  }, [key]);
  return { ...(reading?.key === key ? reading.value : emptyHistoryReading()), refresh, retry, back, loadMore, openDetail };
}
