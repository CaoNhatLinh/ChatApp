import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Message } from '@/features/messenger/types/messenger.types';
import { getChatScrollAction, isNearHistoryEnd, type HistoryPosition } from './chat-scroll-policy';

const messageKey = (message: Message) => message.clientMessageId || message.messageId;

export const useChatScroll = (
  scrollRef: RefObject<HTMLDivElement | null>,
  conversationId: string | null,
  messages: Message[],
  currentUserId?: string,
) => {
  const previous = useRef<(HistoryPosition & { height: number; top: number }) | null>(null);
  const nearEnd = useRef(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const onScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    nearEnd.current = isNearHistoryEnd(element.scrollHeight, element.clientHeight, element.scrollTop);
    if (previous.current) {
      previous.current.height = element.scrollHeight;
      previous.current.top = element.scrollTop;
    }
    if (nearEnd.current) setHasNewMessages(false);
  }, [scrollRef]);

  const scrollToLatest = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    nearEnd.current = true;
    element.scrollTo({
      top: element.scrollHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    setHasNewMessages(false);
  }, [scrollRef]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const last = messages.at(-1);
    const position: HistoryPosition = {
      conversationId,
      firstKey: messages[0] ? messageKey(messages[0]) : null,
      lastKey: last ? messageKey(last) : null,
    };
    const old = previous.current;
    const ownAppend = Boolean(last && last.sender.userId === currentUserId && old?.lastKey &&
      position.lastKey !== old.lastKey && messages.some((message) => messageKey(message) === old.lastKey));
    const action = getChatScrollAction(old, position, nearEnd.current, ownAppend);
    if (action === 'latest') {
      element.scrollTop = element.scrollHeight;
      nearEnd.current = true;
      setHasNewMessages(false);
    } else if (action === 'anchor' && old) {
      element.scrollTop = old.top + element.scrollHeight - old.height;
    } else if (action === 'notify') {
      setHasNewMessages(true);
    }
    previous.current = { ...position, height: element.scrollHeight, top: element.scrollTop };
  }, [conversationId, currentUserId, messages, scrollRef]);

  return { onScroll, scrollToLatest, hasNewMessages };
};
