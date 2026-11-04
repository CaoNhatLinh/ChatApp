import apiClient from '@/shared/api/apiClient';
import type { BackendMessage } from './messenger.api';

export interface MessageKey { conversationId: string; messageBucket: string; messageId: string }
export interface MessageThreadPage {
  parent: BackendMessage;
  content: BackendMessage[];
  nextCursor: string | null;
  hasNext: boolean;
}

const messageTypes = new Set(['TEXT', 'IMAGE', 'FILE', 'AUDIO', 'VIDEO', 'STICKER', 'GIF', 'POLL', 'SYSTEM']);
function isMessage(value: unknown): value is BackendMessage {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<BackendMessage>;
  return typeof row.messageId === 'string' && typeof row.messageBucket === 'string'
    && typeof row.conversationId === 'string' && typeof row.senderId === 'string'
    && typeof row.content === 'string' && typeof row.contentFormat === 'string'
    && typeof row.messageType === 'string' && messageTypes.has(row.messageType)
    && typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt))
    && typeof row.isDeleted === 'boolean' && typeof row.hasAttachments === 'boolean';
}

export async function getMessageThread(scope: MessageKey, options: { cursor?: string | null; signal: AbortSignal }): Promise<MessageThreadPage> {
  const { data } = await apiClient.get(`/conversations/${scope.conversationId}/messages/${scope.messageId}/replies`, {
    params: { bucket: scope.messageBucket, limit: 25, ...(options.cursor ? { cursor: options.cursor } : {}) }, signal: options.signal,
  });
  if (!data || typeof data !== 'object') throw new Error('Invalid thread page');
  const page = data as Partial<MessageThreadPage>;
  if (!isMessage(page.parent) || page.parent.conversationId !== scope.conversationId
    || page.parent.messageBucket !== scope.messageBucket || page.parent.messageId !== scope.messageId
    || !Array.isArray(page.content) || page.content.length > 50 || typeof page.hasNext !== 'boolean'
    || !(page.nextCursor === null || typeof page.nextCursor === 'string')
    || (page.hasNext && (!page.nextCursor || page.nextCursor.length > 1024 || page.nextCursor === options.cursor))
    || (!page.hasNext && page.nextCursor !== null)
    || page.content.some(row => !isMessage(row) || row.conversationId !== scope.conversationId
      || (!row.isDeleted && (row.replyToMessageId !== scope.messageId || row.replyToMessageBucket !== scope.messageBucket)))
    || new Set(page.content.map(row => row.messageId)).size !== page.content.length) {
    throw new Error('Invalid thread page or continuation');
  }
  return page as MessageThreadPage;
}
