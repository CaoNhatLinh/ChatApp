import apiClient from '@/shared/api/apiClient';

export interface InvitePreview {
    status: 'ACTIVE' | 'INVALID' | 'INACTIVE' | 'REVOKED' | 'EXPIRED' | 'LIMIT_REACHED';
    conversationId?: string | null;
    conversationName?: string | null;
    conversationType?: string | null;
    createdBy?: string | null;
    displayName?: string | null;
    joinPolicy?: 'DIRECT_JOIN' | 'REQUEST_APPROVAL' | null;
    expiresAt?: string | null;
    remainingUses?: number | null;
}

export interface InviteConsumeResponse {
    status: string;
    conversationId?: string | null;
}

export interface InviteLinkRecord {
    linkId: string;
    linkToken: string;
    conversationId: string;
    createdBy: string;
    createdAt: string;
    inviteKind: 'LINK' | 'QR';
    joinPolicy: 'DIRECT_JOIN' | 'REQUEST_APPROVAL';
    displayName: string;
    expiresAt: string;
    isActive: boolean;
    maxUses?: number | null;
    usedCount: number;
    revokedBy?: string | null;
    revokedAt?: string | null;
}

export interface InviteLinkView {
    invite: InviteLinkRecord;
    joinUrl: string;
}

export interface JoinRequestView {
    conversationId: string;
    requestedAt: string;
    requestId: string;
    userId: string;
    linkId?: string | null;
    status: string;
    resolvedBy?: string | null;
    resolvedAt?: string | null;
}

export const previewInvite = async (token: string): Promise<InvitePreview> => {
    const response = await apiClient.get<InvitePreview>(`/public/invites/${encodeURIComponent(token)}`);
    return response.data;
};

export const acceptInvite = async (token: string): Promise<InviteConsumeResponse> => {
    const response = await apiClient.post<InviteConsumeResponse>('/invites/consume', { linkToken: token });
    return response.data;
};

export const declineInvite = async (token: string): Promise<InviteConsumeResponse> => {
    const response = await apiClient.post<InviteConsumeResponse>(`/invites/${encodeURIComponent(token)}/decline`);
    return response.data;
};

export const createInvite = async (
    conversationId: string,
    input: { inviteKind: 'LINK' | 'QR'; joinPolicy: 'DIRECT_JOIN' | 'REQUEST_APPROVAL'; displayName: string; durationMinutes: number; maxUses?: number },
): Promise<InviteLinkView> => {
    const response = await apiClient.post<InviteLinkView>('/invites', { conversationId, ...input });
    return response.data;
};

export const listInvites = async (conversationId: string): Promise<InviteLinkRecord[]> => {
    const response = await apiClient.get<InviteLinkRecord[]>(`/invites/conversation/${conversationId}`);
    return response.data;
};

export const revokeInvite = async (token: string): Promise<void> => {
    await apiClient.delete(`/invites/${encodeURIComponent(token)}`);
};

export const listJoinRequests = async (conversationId: string): Promise<JoinRequestView[]> => {
    const response = await apiClient.get<JoinRequestView[]>(`/invites/conversation/${conversationId}/requests`);
    return response.data;
};

export const resolveJoinRequest = async (
    request: JoinRequestView,
    decision: 'APPROVE' | 'DECLINE',
): Promise<JoinRequestView> => {
    const response = await apiClient.post<JoinRequestView>(
        `/invites/conversation/${request.conversationId}/requests/${request.requestId}/resolve`,
        { requestedAt: request.requestedAt, userId: request.userId, decision },
    );
    return response.data;
};
