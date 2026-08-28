import apiClient from '@/shared/api/apiClient';
import type { UserDTO } from '@/entities/user/model/user.types';

export interface AdminOverview {
  actorId: string;
  roles: string[];
  permissions: string[];
  availableRoleCodes: string[];
}

export interface AdminRoleGrant {
  userId: string;
  roleCode: string;
  grantId: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string | null;
}

export interface AdminSession {
  tokenId: string;
  issuedAt: string;
  deviceId?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  replacedByTokenId?: string | null;
}

export interface AdminDevice {
  deviceId: string;
  platform?: string | null;
  pushProvider?: string | null;
  deviceName?: string | null;
  appVersion?: string | null;
  active: boolean;
  createdAt?: string | null;
  lastSeenAt?: string | null;
}

export interface AdminAnalyticsPoint {
  eventDay: string;
  eventType: string;
  eventShard?: number | null;
  eventId: string;
  actorId?: string | null;
  conversationId?: string | null;
  dimensions?: Record<string, string>;
}

export interface AdminHealthSnapshot {
  status: string;
  service: string;
  runtimeMode: string;
  cassandra: string;
  timestamp: string;
}

export interface AdminConversationSummary {
  conversationId: string;
  conversationType: string;
  visibility: string;
  joinPolicy: string;
  name?: string | null;
  description?: string | null;
  ownerId?: string | null;
  memberCount: number;
  chatMode: string;
  slowModeSeconds: number;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  members: AdminConversationMember[];
}

export interface AdminConversationMember {
  userId: string;
  joinedAt?: string;
  mutedUntil?: string | null;
  messageIntervalSeconds?: number | null;
}

export interface AdminAuditEvent {
  eventMonth: string;
  eventId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorId?: string | null;
  conversationId?: string | null;
  targetUserId?: string | null;
  outcome: string;
  reasonCode?: string | null;
  beforeState?: Record<string, string>;
  afterState?: Record<string, string>;
  requestId?: string | null;
  createdAt: string;
}

export interface AdminReport {
  reportId: string;
  createdAtKey: string;
  reportDay: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';
  reporterId: string;
  targetType: string;
  targetUserId?: string | null;
  conversationId?: string | null;
  messageBucket?: string | null;
  messageId?: string | null;
  reasonCode: string;
  description?: string | null;
  assignedTo?: string | null;
  resolvedAt?: string | null;
  resolutionCode?: string | null;
}

export interface AdminSanction {
  userId: string;
  imposedAt: string;
  sanctionId: string;
  scope: 'APP' | 'CONVERSATION';
  conversationId?: string | null;
  sanctionType: 'BAN' | 'MUTE' | 'SUSPEND' | 'WARNING';
  startsAt: string;
  expiresAt?: string | null;
  imposedBy: string;
  reasonCode?: string | null;
  reasonText: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  revokedBy?: string | null;
  revokedAt?: string | null;
}

interface CanonicalPublicUser {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  accountStatus: string;
  createdAt?: string;
}

interface CanonicalUserSearchPage {
  content: CanonicalPublicUser[];
  nextCursor?: string;
  hasNext: boolean;
}

const toUserDto = (user: CanonicalPublicUser): UserDTO => ({
  userId: user.userId,
  userName: user.username,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl,
  createdAt: user.createdAt,
  status: user.accountStatus,
});

export const getAdminOverview = async (): Promise<AdminOverview> => {
  const response = await apiClient.get<AdminOverview>('/admin/overview');
  return response.data;
};

export const getAdminHealth = async (): Promise<AdminHealthSnapshot> => {
  const response = await apiClient.get<AdminHealthSnapshot>('/health');
  return response.data;
};

export const searchAdminUsers = async (query: string): Promise<UserDTO[]> => {
  const response = await apiClient.get<CanonicalUserSearchPage>('/users/search', {
    params: { q: query, limit: 20 },
  });
  return response.data.content.map(toUserDto);
};

export const getAdminUserRoles = async (userId: string): Promise<AdminRoleGrant[]> => {
  const response = await apiClient.get<AdminRoleGrant[]>(`/admin/users/${userId}/app-roles`);
  return response.data;
};

export const grantAdminRole = async (
  userId: string,
  roleCode: string,
  reason: string,
  expiresAt?: string,
): Promise<AdminRoleGrant> => {
  const response = await apiClient.post<AdminRoleGrant>(`/admin/users/${userId}/app-roles`, {
    roleCode,
    reason: reason.trim() || undefined,
    expiresAt: expiresAt || undefined,
  });
  return response.data;
};

export const revokeAdminRole = async (userId: string, roleCode: string, reason: string): Promise<void> => {
  await apiClient.delete(`/admin/users/${userId}/app-roles/${encodeURIComponent(roleCode)}`, {
    data: { roleCode, reason: reason.trim() || undefined },
  });
};

export const updateAdminUserStatus = async (
  userId: string,
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'BANNED',
  reason: string,
): Promise<void> => {
  await apiClient.put(`/admin/users/${userId}/status`, {
    accountStatus,
    reason: reason.trim() || undefined,
  });
};

export const listAdminSessions = async (userId: string, limit = 50): Promise<AdminSession[]> => {
  const response = await apiClient.get<AdminSession[]>(`/admin/users/${userId}/sessions`, { params: { limit } });
  return response.data;
};

export const revokeAdminSession = async (userId: string, tokenId: string, reason: string): Promise<void> => {
  await apiClient.delete(`/admin/users/${userId}/sessions/${tokenId}`, { params: { reason: reason.trim() } });
};

export const listAdminDevices = async (userId: string, limit = 50): Promise<AdminDevice[]> => {
  const response = await apiClient.get<AdminDevice[]>(`/admin/users/${userId}/devices`, { params: { limit } });
  return response.data;
};

export const revokeAdminDevice = async (userId: string, deviceId: string, reason: string): Promise<void> => {
  await apiClient.delete(`/admin/users/${userId}/devices/${deviceId}`, { params: { reason: reason.trim() } });
};

export const listAdminConversations = async (month?: string, limit = 50): Promise<AdminConversationSummary[]> => {
  const response = await apiClient.get<AdminConversationSummary[]>('/admin/conversations', {
    params: { month, limit },
  });
  return response.data;
};

export const getAdminConversation = async (conversationId: string): Promise<AdminConversationSummary> => {
  const response = await apiClient.get<AdminConversationSummary>(`/admin/conversations/${conversationId}`, {
    params: { limit: 200 },
  });
  return response.data;
};

export const updateAdminConversationPolicy = async (
  conversationId: string,
  chatMode: string,
  slowModeSeconds: number,
  reason: string,
): Promise<AdminConversationSummary> => {
  const response = await apiClient.put<AdminConversationSummary>(`/admin/conversations/${conversationId}/chat-policy`, {
    chatMode,
    slowModeSeconds,
    reason: reason.trim() || undefined,
  });
  return response.data;
};

export const archiveAdminConversation = async (conversationId: string, reason: string): Promise<AdminConversationSummary> => {
  const response = await apiClient.delete<AdminConversationSummary>(`/admin/conversations/${conversationId}`, {
    params: { reason: reason.trim() || undefined },
  });
  return response.data;
};

export const restoreAdminConversation = async (conversationId: string, reason: string): Promise<AdminConversationSummary> => {
  const response = await apiClient.post<AdminConversationSummary>(`/admin/conversations/${conversationId}/restore`, null, {
    params: { reason: reason.trim() || undefined },
  });
  return response.data;
};

export const listAdminAuditEvents = async (month?: string, limit = 50): Promise<AdminAuditEvent[]> => {
  const response = await apiClient.get<AdminAuditEvent[]>('/admin/audit', {
    params: { month, limit },
  });
  return response.data;
};

export const listAdminAnalytics = async (params: {
  from?: string;
  to?: string;
  eventType?: string;
  limit?: number;
} = {}): Promise<AdminAnalyticsPoint[]> => {
  const response = await apiClient.get<AdminAnalyticsPoint[]>('/admin/analytics', {
    params: { ...params, limit: params.limit ?? 200 },
  });
  return response.data;
};

export const listAdminReports = async (status = 'OPEN', day?: string, limit = 50): Promise<AdminReport[]> => {
  const response = await apiClient.get<AdminReport[]>('/admin/reports', { params: { status, day, limit } });
  return response.data;
};

export const resolveAdminReport = async (
  report: AdminReport,
  nextStatus: AdminReport['status'],
  resolutionCode: string,
  reason: string,
): Promise<AdminReport> => {
  const response = await apiClient.put<AdminReport>(`/admin/reports/${report.reportId}`, {
    currentStatus: report.status,
    reportDay: report.reportDay,
    createdAtKey: report.createdAtKey,
    nextStatus,
    resolutionCode: resolutionCode.trim() || undefined,
    reason: reason.trim() || undefined,
  });
  return response.data;
};

export const listAdminSanctions = async (userId: string, limit = 50): Promise<AdminSanction[]> => {
  const response = await apiClient.get<AdminSanction[]>(`/admin/users/${userId}/sanctions`, { params: { limit } });
  return response.data;
};

export const imposeAdminSanction = async (request: {
  userId: string;
  scope: AdminSanction['scope'];
  conversationId?: string;
  sanctionType: AdminSanction['sanctionType'];
  expiresAt?: string;
  reasonCode?: string;
  reasonText: string;
}): Promise<AdminSanction> => {
  const response = await apiClient.post<AdminSanction>('/admin/sanctions', request);
  return response.data;
};

export const revokeAdminSanction = async (
  sanction: AdminSanction,
  reason: string,
): Promise<AdminSanction> => {
  const response = await apiClient.delete<AdminSanction>(
    `/admin/users/${sanction.userId}/sanctions/${sanction.sanctionId}`,
    { params: { imposedAt: sanction.imposedAt, reason: reason.trim() } },
  );
  return response.data;
};
