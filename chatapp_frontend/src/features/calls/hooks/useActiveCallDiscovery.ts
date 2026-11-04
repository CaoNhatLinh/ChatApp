import { useCallback, useEffect, useRef, useState } from 'react';
import { getActiveCall, type ActiveCallScope } from '../api/active-call.api';
import type { CallSnapshot } from '../model/call-command-channel';
import { addConnectionListener } from '@/shared/websocket/websocketService';

export interface CallDiscovery {
  status: 'idle' | 'loading' | 'ready' | 'error';
  retry: () => void;
}

export function useActiveCallDiscovery(scope: ActiveCallScope | null, onSnapshot: (snapshot: CallSnapshot) => void): CallDiscovery {
  const room = scope?.conversationId, actor = scope?.actorId, peer = scope?.peerUserId;
  const key = `${actor ?? ''}/${room ?? ''}/${peer ?? ''}`;
  const callback = useRef(onSnapshot);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: '', status: 'idle' as CallDiscovery['status'] });
  useEffect(() => { callback.current = onSnapshot; }, [onSnapshot]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    if (!room || !actor || !peer) return;
    let current: AbortController | null = null;
    let disposed = false;
    const load = () => {
      current?.abort();
      const request = new AbortController(); current = request;
      setResult({ key, status: 'loading' });
      void getActiveCall({ conversationId: room, actorId: actor, peerUserId: peer }, request.signal).then(snapshot => {
        if (disposed || request.signal.aborted || current !== request) return;
        if (snapshot) callback.current(snapshot);
        setResult({ key, status: 'ready' });
      }).catch(() => {
        if (!disposed && !request.signal.aborted && current === request) setResult({ key, status: 'error' });
      });
    };
    load();
    // Registration may synchronously report an already-ready socket; initial load owns that read.
    let registering = true;
    const unsubscribe = addConnectionListener(() => {
      if (!registering) queueMicrotask(() => { if (!disposed) load(); });
    });
    registering = false;
    return () => { disposed = true; current?.abort(); unsubscribe(); };
  }, [actor, attempt, key, peer, room]);
  return { status: !scope ? 'idle' : result.key !== key ? 'loading' : result.status, retry };
}
