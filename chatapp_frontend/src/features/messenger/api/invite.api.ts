import apiClient from '@/shared/api/apiClient';
import {
    parseInviteConsumeResponse,
    parseInvitePreview,
    parseInviteRecord,
    parseInviteViewerState,
    parseInviteView,
    parseJoinRequest,
    type InviteConsumeResponse,
    type InviteLinkRecord,
    type InviteLinkView,
    type InvitePreview,
    type InviteViewerState,
    type JoinRequestView,
} from './invite.contracts';

export type {
    InviteConsumeResponse,
    InviteLinkRecord,
    InviteLinkView,
    InvitePreview,
    InviteViewerState,
    JoinRequestView,
} from './invite.contracts';

export const previewInvite = async (token: string): Promise<InvitePreview> => {
    const response = await apiClient.get(`/public/invites/${encodeURIComponent(token)}`);
    return parseInvitePreview(response.data);
};

export const acceptInvite = async (token: string): Promise<InviteConsumeResponse> => {
    const response = await apiClient.post('/invites/consume', { linkToken: token });
    return parseInviteConsumeResponse(response.data);
};

export const getInviteViewerState = async (token: string): Promise<InviteViewerState> => {
    const response = await apiClient.get(`/invites/${encodeURIComponent(token)}/status`);
    return parseInviteViewerState(response.data);
};

export const declineInvite = async (token: string): Promise<InviteConsumeResponse> => {
    const response = await apiClient.post(`/invites/${encodeURIComponent(token)}/decline`);
    return parseInviteConsumeResponse(response.data);
};

export const createInvite = async (
    conversationId: string,
    input: { inviteKind: 'LINK' | 'QR'; joinPolicy: 'DIRECT_JOIN' | 'REQUEST_APPROVAL'; displayName: string; durationMinutes: number; maxUses?: number },
): Promise<InviteLinkView> => {
    const response = await apiClient.post('/invites', { conversationId, ...input });
    return parseInviteView(response.data);
};

export const listInvites = async (conversationId: string): Promise<InviteLinkRecord[]> => {
    const response = await apiClient.get(`/invites/conversation/${conversationId}`);
    if (!Array.isArray(response.data)) throw new Error('Invite list response is invalid');
    return response.data.map(parseInviteRecord);
};

export const revokeInvite = async (token: string): Promise<void> => {
    await apiClient.delete(`/invites/${encodeURIComponent(token)}`);
};

export const listJoinRequests = async (conversationId: string): Promise<JoinRequestView[]> => {
    const response = await apiClient.get(`/invites/conversation/${conversationId}/requests`);
    if (!Array.isArray(response.data)) throw new Error('Join request list response is invalid');
    return response.data.map(parseJoinRequest);
};

export const resolveJoinRequest = async (
    request: JoinRequestView,
    decision: 'APPROVE' | 'DECLINE',
): Promise<JoinRequestView> => {
    const response = await apiClient.post(
        `/invites/conversation/${request.conversationId}/requests/${request.requestId}/resolve`,
        { requestedAt: request.requestedAt, userId: request.userId, decision },
    );
    return parseJoinRequest(response.data);
};
