import apiClient from '@/shared/api/apiClient';

export interface MessageAttachmentKey { conversationId: string; messageBucket: string; messageId: string }
export interface MessageAttachmentView {
  attachmentId: string;
  assetId: string | null;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  spoiler: boolean;
  status: 'READY' | 'UNAVAILABLE';
  url: string | null;
  thumbnailUrl: string | null;
}
export interface MessageAttachmentPage extends MessageAttachmentKey {
  content: MessageAttachmentView[];
  nextCursor: string | null;
  hasNext: boolean;
}
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const safeUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.hash; }
  catch { return false; }
};
const optionalInteger = (value: unknown, minimum: number) => value === null || Number.isSafeInteger(value) && Number(value) >= minimum;
const validItem = (item: MessageAttachmentView) => item && uuid.test(item.attachmentId)
  && (item.assetId === null || uuid.test(item.assetId)) && typeof item.fileName === 'string' && item.fileName.length > 0
  && typeof item.mimeType === 'string' && item.mimeType.length > 0 && Number.isSafeInteger(item.byteSize) && item.byteSize >= 0
  && optionalInteger(item.width, 1) && optionalInteger(item.height, 1) && optionalInteger(item.durationMs, 0)
  && typeof item.spoiler === 'boolean'
  && (item.status === 'READY' ? safeUrl(item.url) && (item.thumbnailUrl === null || safeUrl(item.thumbnailUrl))
    : item.status === 'UNAVAILABLE' && item.url === null && item.thumbnailUrl === null);

export async function getMessageAttachments(key: MessageAttachmentKey, cursor: string | null, signal?: AbortSignal): Promise<MessageAttachmentPage> {
  const scope = { ...key };
  if (!uuid.test(scope.conversationId) || !uuid.test(scope.messageId) || !/^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}$/.test(scope.messageBucket)
      || cursor !== null && !uuid.test(cursor)) throw new Error('Invalid message attachment key');
  const { data } = await apiClient.get<MessageAttachmentPage>(`/conversations/${scope.conversationId}/messages/${scope.messageId}/attachments`, {
    params: { bucket: scope.messageBucket, limit: 25, cursor: cursor ?? undefined }, signal, headers: { 'Cache-Control': 'no-store' },
  });
  if (!data || data.conversationId !== scope.conversationId || data.messageId !== scope.messageId || data.messageBucket !== scope.messageBucket
      || !Array.isArray(data.content) || data.content.length > 25 || !data.content.every(validItem)
      || new Set(data.content.map(item => item.attachmentId)).size !== data.content.length
      || typeof data.hasNext !== 'boolean' || (data.hasNext
        ? !data.content.length || !uuid.test(data.nextCursor ?? '') || data.nextCursor !== data.content.at(-1)?.attachmentId || data.nextCursor === cursor
        : data.nextCursor !== null)) throw new Error('Invalid canonical message attachment page');
  return { ...data, content: data.content.map(item => ({ ...item })) };
}
