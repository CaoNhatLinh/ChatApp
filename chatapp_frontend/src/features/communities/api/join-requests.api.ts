import { apiClient } from '@/shared/api/apiClient';

export interface OwnJoinRequest {
  conversationId: string;
  requestedAt: string;
  requestedOn: string;
  requestId: string;
  linkId: string | null;
  status: 'PENDING' | 'APPROVING' | 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'FAILED' | 'RETRY_REQUIRED';
  resolvedAt: string | null;
}

export interface OwnJoinRequestPage {
  content: OwnJoinRequest[];
  nextCursor: string | null;
  hasNext: boolean;
}

export async function listOwnJoinRequests(cursor?: string, signal?: AbortSignal): Promise<OwnJoinRequestPage> {
  const { data } = await apiClient.get<OwnJoinRequestPage>('/me/join-requests', {
    params: { cursor, limit: 25 }, signal,
  });
  return data;
}
