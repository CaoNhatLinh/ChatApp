import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { getSessionGeneration } from '@/shared/auth/access-token';
import { realtimeService } from '@/shared/websocket/realtime-service';
import { addConnectionListener, isWebSocketReady } from '@/shared/websocket/websocketService';
import { useIncomingCallStore } from '../model/incoming-call.store';
import type { IncomingCallItem } from '../model/incoming-call-inbox';
import { IncomingCallDiscovery, type IncomingDiscoveryStatus } from '../model/incoming-call-discovery';

const empty: IncomingCallItem[] = [];
type LookupStatus = IncomingDiscoveryStatus | 'waiting' | 'dismissed';
interface LookupActions { retry: () => void; loadMore: () => void; dismiss: () => void }

export function useIncomingCallInbox() {
  const { actorId, token, unavailable } = useAuthStore(useShallow(state => ({
    actorId: state.user?.userId ?? null, token: state.token,
    unavailable: state.loading || Boolean(state.initializationError),
  })));
  const generation = getSessionGeneration();
  const key = `${actorId}/${generation}`;
  const inbox = useIncomingCallStore();
  const [now, setNow] = useState(Date.now);
  const [lookup, setLookup] = useState<{ key: string; status: LookupStatus }>({ key: '', status: 'waiting' });
  const actions = useRef<LookupActions | null>(null);
  const retry = useCallback(() => actions.current?.retry(), []);
  const loadMore = useCallback(() => actions.current?.loadMore(), []);
  const dismiss = useCallback(() => actions.current?.dismiss(), []);
  useEffect(() => {
    useIncomingCallStore.getState().setScope(actorId && token ? actorId : null, generation);
    if (!actorId || !token || unavailable) return;
    let disposed = false;
    const current = () => {
      const auth = useAuthStore.getState(), scope = useIncomingCallStore.getState();
      return !disposed && generation === getSessionGeneration() && scope.actorId === actorId && scope.generation === generation
        && auth.user?.userId === actorId && !auth.loading && !auth.initializationError;
    };
    const status = (status: LookupStatus) => { if (current()) setLookup({ key, status }); };
    const discovery = new IncomingCallDiscovery(actorId, { current, status, receive: snapshot => {
      if (!current()) return;
      setNow(Date.now());
      useIncomingCallStore.getState().receiveSnapshot(snapshot, actorId, generation);
    } });
    const connect = () => { void realtimeService.connect(token).catch(() => status('error')); };
    const whenReady = (action: () => void) => {
      if (!current()) return;
      if (isWebSocketReady()) action();
      else { status('waiting'); connect(); }
    };
    status('waiting');
    actions.current = { retry: () => whenReady(() => discovery.refresh()), loadMore: () => whenReady(() => discovery.loadMore()),
      dismiss: () => setLookup(value => value.key === key && value.status === 'error' ? { key, status: 'dismissed' } : value) };
    const unsubscribe = realtimeService.subscribe('/user/queue/calls', event => {
      if (!current()) return;
      setNow(Date.now());
      useIncomingCallStore.getState().receive(event, actorId, generation);
    });
    // Realtime restoration listeners finish synchronously before the lookup microtask.
    const connection = addConnectionListener(() => queueMicrotask(() => {
      if (current() && isWebSocketReady()) discovery.refresh();
    }));
    connect();
    return () => { disposed = true; actions.current = null; discovery.dispose(); connection(); unsubscribe(); };
  }, [actorId, generation, key, token, unavailable]);
  const items = inbox.actorId === actorId && inbox.generation === generation ? inbox.items : empty;
  const ringing = items.some(item => !item.hidden && item.snapshot.status === 'RINGING' && Date.parse(item.snapshot.deadline) > now);
  useEffect(() => {
    if (!ringing) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ringing]);
  return { items, now, actorId, generation, enabled: Boolean(actorId && token && !unavailable),
    lookupStatus: lookup.key === key ? lookup.status : 'waiting' as LookupStatus, retry, loadMore, dismiss };
}
