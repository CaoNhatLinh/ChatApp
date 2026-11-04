import type { Message } from '@/features/messenger/types/messenger.types';
import { compareMessageIds } from '@/features/messenger/model/message-order';

export interface ReadState { lastReadMessageId: string | null; lastReadAt: string | null; joinedAt: string }

export function getUnreadBoundary(messages: Message[], state: ReadState | null, userId: string | undefined, hasOlder: boolean) {
  if (!state) return { messageId: null, above: false };
  const after = (message: Message) => state.lastReadMessageId
    ? compareMessageIds(message.messageId, state.lastReadMessageId) === 1
    : new Date(message.createdAt).getTime() >= new Date(state.joinedAt).getTime();
  const first = messages[0];
  const above = Boolean(first && hasOlder && after(first) && first.messageId !== state.lastReadMessageId);
  const unread = messages.find(message => !message.isDeleted && message.sender.userId !== userId && after(message));
  return { messageId: above ? null : unread?.messageId ?? null, above };
}
