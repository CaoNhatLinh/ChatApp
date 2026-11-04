import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import apiClient from '@/shared/api/apiClient';
import { markMessagesAsRead } from '@/features/messenger/api/messenger.api';
import { useMessengerStore } from '@/features/messenger/model/messenger.store';
import type { Message } from '@/features/messenger/types/messenger.types';
import { useNotificationStore } from '@/features/notifications/model/notification.store';
import { isNearHistoryEnd } from './chat-scroll-policy';
import { getUnreadBoundary, type ReadState } from './unread-boundary';
import { compareMessageIds } from '@/features/messenger/model/message-order';

export function useReadTracking(conversationId: string | null, userId: string | undefined, messages: Message[],
  hasOlder: boolean, scrollRef: RefObject<HTMLDivElement | null>, enabled = true) {
  const [entry, setEntry] = useState<{ conversationId: string; state: ReadState } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [ackVersion, setAckVersion] = useState(0);
  const acknowledged = useRef<string | null>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    generation.current++;
    acknowledged.current = null;
    inFlight.current = false;
    setError(false);
    setEntry(null);
    if (conversationId) void apiClient.get<ReadState>(`/conversations/${conversationId}/read-state`, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setEntry({ conversationId, state: response.data }); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [conversationId, userId, retry]);

  const state = entry?.conversationId === conversationId ? entry.state : null;
  const acknowledge = useCallback(async () => {
    const element = scrollRef.current;
    if (!enabled || !conversationId || !state || !element || document.visibilityState !== 'visible'
      || !isNearHistoryEnd(element.scrollHeight, element.clientHeight, element.scrollTop) || inFlight.current) return;
    const latest = [...messages].reverse().find(message => !message.isDeleted && message.messageBucket);
    if (!latest || latest.messageId === acknowledged.current) return;
    const requestGeneration = generation.current;
    inFlight.current = true;
    try {
      await markMessagesAsRead(conversationId, [latest]);
      if (requestGeneration !== generation.current) return;
      acknowledged.current = latest.messageId;
      setAckVersion(value => value + 1);
      setError(false);
      // Count only messages that arrived after this acknowledged snapshot, never blindly reset to zero.
      const store = useMessengerStore.getState();
      const remaining = (store.messages[conversationId] ?? []).filter(message => !message.isDeleted
        && !message.senderBlockedByViewer && message.sender.userId !== userId
        && compareMessageIds(message.messageId, latest.messageId) === 1).length;
      store.setConversationUnreadCount(conversationId, remaining);
      void useNotificationStore.getState().markConversationAsRead(conversationId).catch(() => undefined);
    } catch { if (requestGeneration === generation.current) setError(true); }
    finally { if (requestGeneration === generation.current) inFlight.current = false; }
  }, [conversationId, enabled, messages, scrollRef, state, userId]);

  useEffect(() => {
    const element = scrollRef.current;
    const schedule = () => { void acknowledge(); };
    const timer = window.setTimeout(schedule, 350);
    element?.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('visibilitychange', schedule);
    return () => { clearTimeout(timer); element?.removeEventListener('scroll', schedule); document.removeEventListener('visibilitychange', schedule); };
  }, [acknowledge, ackVersion, scrollRef]);

  // Entry marker stays fixed for this visit even after a successful read acknowledgment.
  return { ...getUnreadBoundary(messages, state, userId, hasOlder), error,
    retry: () => { if (state) void acknowledge(); else setRetry(value => value + 1); } };
}
