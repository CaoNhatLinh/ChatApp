import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessageKey } from '../api/thread.api';

export function useForwardResource<Value>(scope: MessageKey,
  read: (key: MessageKey, signal: AbortSignal) => Promise<Value>, revalidateOnFocus = false) {
  const { conversationId, messageBucket, messageId } = scope;
  const [state, setState] = useState<{ value?: Value; loading: boolean; error: boolean }>({ loading: true, error: false });
  const request = useRef<AbortController | null>(null);
  const reload = useCallback(() => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setState({ loading: true, error: false });
    void read({ conversationId, messageBucket, messageId }, controller.signal)
      .then(value => { if (!controller.signal.aborted) setState({ value, loading: false, error: false }); })
      .catch(() => { if (!controller.signal.aborted) setState({ loading: false, error: true }); });
  }, [conversationId, messageBucket, messageId, read]);
  useEffect(() => {
    reload();
    if (revalidateOnFocus) window.addEventListener('focus', reload);
    return () => { request.current?.abort(); window.removeEventListener('focus', reload); };
  }, [reload, revalidateOnFocus]);
  return { ...state, reload };
}
