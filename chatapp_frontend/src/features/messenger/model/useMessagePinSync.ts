import { useEffect, useRef, useState } from 'react';
import { getMessagePinState } from '@/features/messenger/api/messenger.api';
import { useMessengerStore } from './messenger.store';
import { addConnectionListener } from '@/shared/websocket/websocketService';
import { logger } from '@/shared/lib/logger';

export function useMessagePinSync(conversationId: string) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const refresh = useRef<() => void>(() => undefined);

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    const load = () => {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      setStatus('loading');
      void getMessagePinState(conversationId, controller.signal).then(snapshot => {
        if (controller.signal.aborted) return;
        useMessengerStore.getState().applyMessagePinState(snapshot);
        setStatus('ready');
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        logger.debug('Message pin state lookup failed', String(error));
        setStatus('error');
      }).finally(() => { inFlight = false; });
    };
    refresh.current = load;
    load();
    const unsubscribe = addConnectionListener(load);
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [conversationId]);

  return { status, retry: () => refresh.current() };
}
