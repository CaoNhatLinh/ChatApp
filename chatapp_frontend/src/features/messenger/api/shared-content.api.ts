import apiClient from '@/shared/api/apiClient';
import type { BackendMessage } from './messenger.api';

export type SharedContentKind = 'IMAGES' | 'FILES' | 'LINKS';
export interface SharedContentItem {
  id: string;
  messageId: string;
  messageBucket: string;
  createdAt: string;
  url: string;
  name: string;
  mimeType: string | null;
  byteSize: number | null;
  spoiler: boolean;
}
export interface SharedContentPage {
  content: SharedContentItem[];
  nextCursor: string | null;
  hasNext: boolean;
}
export const getSharedContent = async (conversationId: string, kind: SharedContentKind, cursor: string | null, signal: AbortSignal) => {
  const response = await apiClient.get<SharedContentPage>(`/conversations/${conversationId}/shared-content`, { params: { kind, cursor }, signal });
  if (response.data.hasNext && (!response.data.nextCursor || response.data.nextCursor === cursor)) {
    throw new Error('Invalid shared-content continuation');
  }
  return response.data;
};
export const getSharedSource = async (conversationId: string, item: SharedContentItem, signal: AbortSignal) => {
  const response = await apiClient.get<BackendMessage>(`/conversations/${conversationId}/shared-content/${item.messageId}`, {
    params: { bucket: item.messageBucket }, signal,
  });
  return response.data;
};
export const safeSharedUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
};
