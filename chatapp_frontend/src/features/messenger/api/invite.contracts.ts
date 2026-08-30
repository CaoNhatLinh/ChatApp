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

export type InviteConsumeStatus = InvitePreview['status'] | 'ACCEPTED' | 'ALREADY_ACCEPTED'
    | 'ALREADY_MEMBER' | 'CAPACITY_REACHED' | 'DECLINED' | 'FAILED' | 'PENDING' | 'RETRY_REQUIRED';

export interface InviteConsumeResponse {
    status: InviteConsumeStatus;
    conversationId?: string | null;
}

export interface InviteViewerState {
    status: 'AVAILABLE' | 'PENDING' | 'ACCEPTED' | 'ALREADY_MEMBER' | 'DECLINED' | 'FAILED' | 'INVALID';
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
    status: 'PENDING' | 'APPROVING' | 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'FAILED';
    resolvedBy?: string | null;
    resolvedAt?: string | null;
}

const PREVIEW_STATUSES = new Set<InvitePreview['status']>([
    'ACTIVE', 'INVALID', 'INACTIVE', 'REVOKED', 'EXPIRED', 'LIMIT_REACHED',
]);
const CONSUME_STATUSES = new Set<InviteConsumeStatus>([
    ...PREVIEW_STATUSES, 'ACCEPTED', 'ALREADY_ACCEPTED', 'ALREADY_MEMBER',
    'CAPACITY_REACHED', 'DECLINED', 'FAILED', 'PENDING', 'RETRY_REQUIRED',
]);
const JOIN_REQUEST_STATUSES = new Set<JoinRequestView['status']>([
    'PENDING', 'APPROVING', 'APPROVED', 'DECLINED', 'CANCELLED', 'FAILED',
]);
const VIEWER_STATUSES = new Set<InviteViewerState['status']>([
    'AVAILABLE', 'PENDING', 'ACCEPTED', 'ALREADY_MEMBER', 'DECLINED', 'FAILED', 'INVALID',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isNullableString = (value: unknown): value is string | null | undefined =>
    value === null || value === undefined || typeof value === 'string';

const isNullableNonNegativeInteger = (value: unknown): value is number | null | undefined =>
    value === null || value === undefined || (Number.isSafeInteger(value) && Number(value) >= 0);

const isNullablePositiveInteger = (value: unknown): value is number | null | undefined =>
    value === null || value === undefined || (Number.isSafeInteger(value) && Number(value) >= 1);

const isTimestamp = (value: unknown): value is string =>
    typeof value === 'string' && Number.isFinite(Date.parse(value));

const isInviteJoinUrl = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') && url.pathname.startsWith('/join/');
    } catch {
        return false;
    }
};

export const parseInvitePreview = (value: unknown): InvitePreview => {
    if (!isRecord(value)
        || typeof value.status !== 'string'
        || !PREVIEW_STATUSES.has(value.status as InvitePreview['status'])
        || !isNullableString(value.conversationId)
        || !isNullableString(value.conversationName)
        || !isNullableString(value.conversationType)
        || !isNullableString(value.createdBy)
        || !isNullableString(value.displayName)
        || (value.joinPolicy !== null && value.joinPolicy !== undefined
            && value.joinPolicy !== 'DIRECT_JOIN' && value.joinPolicy !== 'REQUEST_APPROVAL')
        || (value.expiresAt !== null && value.expiresAt !== undefined && !isTimestamp(value.expiresAt))
        || !isNullableNonNegativeInteger(value.remainingUses)
        || (value.status === 'ACTIVE' && (
            typeof value.conversationId !== 'string'
            || typeof value.conversationName !== 'string'
            || typeof value.conversationType !== 'string'
            || typeof value.displayName !== 'string'
            || (value.joinPolicy !== 'DIRECT_JOIN' && value.joinPolicy !== 'REQUEST_APPROVAL')
            || !isTimestamp(value.expiresAt)))) {
        throw new Error('Invite preview response is invalid');
    }
    return value as unknown as InvitePreview;
};

export const parseInviteConsumeResponse = (value: unknown): InviteConsumeResponse => {
    if (!isRecord(value) || typeof value.status !== 'string'
        || !CONSUME_STATUSES.has(value.status as InviteConsumeStatus)
        || !isNullableString(value.conversationId)) {
        throw new Error('Invite action response is invalid');
    }
    return value as unknown as InviteConsumeResponse;
};

export const parseInviteViewerState = (value: unknown): InviteViewerState => {
    if (!isRecord(value) || typeof value.status !== 'string'
        || !VIEWER_STATUSES.has(value.status as InviteViewerState['status'])
        || !isNullableString(value.conversationId)) {
        throw new Error('Invite viewer state response is invalid');
    }
    return value as unknown as InviteViewerState;
};

export const parseInviteRecord = (value: unknown): InviteLinkRecord => {
    if (!isRecord(value)
        || typeof value.linkId !== 'string'
        || typeof value.linkToken !== 'string'
        || typeof value.conversationId !== 'string'
        || typeof value.createdBy !== 'string'
        || !isTimestamp(value.createdAt)
        || (value.inviteKind !== 'LINK' && value.inviteKind !== 'QR')
        || (value.joinPolicy !== 'DIRECT_JOIN' && value.joinPolicy !== 'REQUEST_APPROVAL')
        || typeof value.displayName !== 'string'
        || !isTimestamp(value.expiresAt)
        || typeof value.isActive !== 'boolean'
        || !isNullablePositiveInteger(value.maxUses)
        || !Number.isSafeInteger(value.usedCount)
        || Number(value.usedCount) < 0
        || (typeof value.maxUses === 'number' && Number(value.usedCount) > value.maxUses)
        || !isNullableString(value.revokedBy)
        || (value.revokedAt !== null && value.revokedAt !== undefined && !isTimestamp(value.revokedAt))) {
        throw new Error('Invite record response is invalid');
    }
    return value as unknown as InviteLinkRecord;
};

export const parseInviteView = (value: unknown): InviteLinkView => {
    if (!isRecord(value) || !isInviteJoinUrl(value.joinUrl)) {
        throw new Error('Created invite response is invalid');
    }
    return { invite: parseInviteRecord(value.invite), joinUrl: value.joinUrl };
};

export const parseJoinRequest = (value: unknown): JoinRequestView => {
    if (!isRecord(value)
        || typeof value.conversationId !== 'string'
        || typeof value.requestedAt !== 'string'
        || typeof value.requestId !== 'string'
        || typeof value.userId !== 'string'
        || !isNullableString(value.linkId)
        || typeof value.status !== 'string'
        || !JOIN_REQUEST_STATUSES.has(value.status as JoinRequestView['status'])
        || !isNullableString(value.resolvedBy)
        || (value.resolvedAt !== null && value.resolvedAt !== undefined && !isTimestamp(value.resolvedAt))) {
        throw new Error('Join request response is invalid');
    }
    return value as unknown as JoinRequestView;
};
