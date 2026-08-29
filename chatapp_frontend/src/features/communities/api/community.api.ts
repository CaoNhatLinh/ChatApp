import { apiClient } from '@/shared/api/apiClient';

export type CommunityMembershipStatus = 'AVAILABLE' | 'PENDING' | 'JOINED';

export interface CommunitySummary {
  conversationId: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  categoryId?: string | null;
  communityTags: string[];
  languageCode?: string | null;
  joinPolicy: 'DIRECT_JOIN' | 'REQUEST_APPROVAL' | 'CLOSED';
  memberCount: number;
  maxMembers: number;
  lastActivityAt: string;
  membershipStatus: CommunityMembershipStatus;
}

export interface CommunityPage {
  content: CommunitySummary[];
  nextCursor?: string | null;
  hasNext: boolean;
}

export interface CommunityQuery {
  languageCode: 'vi' | 'en';
  query?: string;
  categoryId?: string;
  tag?: string;
  cursor?: string;
  limit?: number;
}

export interface CommunityJoinResponse {
  status: 'JOINED' | 'PENDING' | 'CAPACITY_REACHED' | 'RETRY_REQUIRED';
  conversationId: string;
}

export async function listCommunities(query: CommunityQuery): Promise<CommunityPage> {
  const response = await apiClient.get<CommunityPage>('/communities', { params: query });
  return response.data;
}

export async function joinCommunity(conversationId: string): Promise<CommunityJoinResponse> {
  const response = await apiClient.post<CommunityJoinResponse>(
    `/communities/${encodeURIComponent(conversationId)}/join`,
  );
  return response.data;
}
