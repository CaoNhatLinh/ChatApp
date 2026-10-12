import * as React from 'react';
import { Ban, ChevronDown, Pencil, Plus, RefreshCw, ScrollText, ShieldCheck, Trash2, UserRoundCheck } from 'lucide-react';
import type { Conversation, ConversationMember } from '@/features/messenger/types/messenger.types';
import {
    assignConversationRoles,
    banConversationMember,
    createConversationRole,
    deleteConversationRole,
    getConversationMembers,
    getConversationPermissions,
    listConversationBans,
    listConversationRoles,
    removeConversationMember,
    transferConversationOwnership,
    unbanConversationMember,
    updateConversationChatPolicy,
    updateMemberChatPolicy,
    updateConversationRole,
    type ConversationPermissionsView,
    type ConversationBan,
    type ConversationRole,
} from '@/features/messenger/api/messenger.api';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useMessengerStore } from '@/features/messenger/model/messenger.store';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Textarea } from '@/shared/ui/Textarea';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { logger } from '@/shared/lib/logger';
import { notifyError, notifySuccess } from '@/shared/lib/notification';
import { RoomRoleForm, type RoomRoleFormValue } from './RoomRoleForm';
import { RoomChatPolicyForm } from './RoomChatPolicyForm';
import type { RoomMemberPolicyValue } from './RoomMemberPolicyForm';
import { RoomAuditTimeline } from './RoomAuditTimeline';
import { RoomMemberDirectory } from './RoomMemberDirectory';

const EMPTY_ROLE: RoomRoleFormValue = {
    displayName: '',
    roleCode: '',
    colorHex: '#4F46E5',
    permissionCodes: [],
    isDefault: false,
    rolePosition: 100,
};
const ROOM_MEMBER_PAGE_SIZE = 50;
const ROOM_MANAGEMENT_PERMISSIONS = [
    'ROOM_UPDATE',
    'ROOM_AUDIT_READ',
    'ROLE_ASSIGN',
    'ROLE_CREATE',
    'ROLE_UPDATE',
    'ROLE_DELETE',
    'MEMBER_KICK',
    'MEMBER_BAN',
    'MEMBER_MUTE',
];

type PendingAction =
    | { kind: 'kick'; member: ConversationMember }
    | { kind: 'ban'; member: ConversationMember }
    | { kind: 'unban'; ban: ConversationBan }
    | { kind: 'transfer'; member: ConversationMember }
    | { kind: 'delete-role'; role: ConversationRole }
    | null;

interface RoomManagementPanelProps {
    conversation: Conversation;
}

export function RoomManagementPanel({ conversation }: RoomManagementPanelProps) {
    const { locale } = useAppLocale();
    const currentUserId = useAuthStore((state) => state.user?.userId);
    const updateConversationOwner = useMessengerStore((state) => state.updateConversationOwner);
    const updateStoredChatPolicy = useMessengerStore((state) => state.updateConversationChatPolicy);
    const [members, setMembers] = React.useState<ConversationMember[]>([]);
    const [memberCursor, setMemberCursor] = React.useState<string | null>(null);
    const [hasMoreMembers, setHasMoreMembers] = React.useState(false);
    const [roles, setRoles] = React.useState<ConversationRole[]>([]);
    const [access, setAccess] = React.useState<ConversationPermissionsView | null>(null);
    const [bannedMembers, setBannedMembers] = React.useState<ConversationBan[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState(false);
    const [busyKey, setBusyKey] = React.useState<string | null>(null);
    const [pendingAction, setPendingAction] = React.useState<PendingAction>(null);
    const [banReason, setBanReason] = React.useState('');
    const [showRoleForm, setShowRoleForm] = React.useState(false);
    const [editingRoleId, setEditingRoleId] = React.useState<string | null>(null);
    const [auditOpen, setAuditOpen] = React.useState(false);
    const requestRef = React.useRef(0);
    const initialLoadConversationRef = React.useRef<string | null>(null);
    const memberPageRequestRef = React.useRef<string | null>(null);

    const load = React.useCallback(async () => {
        const requestId = ++requestRef.current;
        setLoading(true);
        setBusyKey(null);
        setLoadError(false);
        try {
            const [memberPage, nextRoles, nextAccess] = await Promise.all([
                getConversationMembers(conversation.conversationId, undefined, ROOM_MEMBER_PAGE_SIZE),
                listConversationRoles(conversation.conversationId),
                getConversationPermissions(conversation.conversationId),
            ]);
            const nextBans = nextAccess.permissions.includes('MEMBER_BAN')
                ? await listConversationBans(conversation.conversationId)
                : [];
            if (requestId !== requestRef.current) return;
            setMembers(memberPage.content);
            setMemberCursor(memberPage.nextCursor);
            setHasMoreMembers(memberPage.hasNext);
            setRoles(nextRoles);
            setAccess(nextAccess);
            setBannedMembers(nextBans);
        } catch (error) {
            if (requestId !== requestRef.current) return;
            setLoadError(true);
            logger.error('[RoomManagementPanel] Load failed', error instanceof Error ? error.message : String(error));
        } finally {
            if (requestId === requestRef.current) setLoading(false);
        }
    }, [conversation.conversationId]);

    React.useEffect(() => {
        if (initialLoadConversationRef.current === conversation.conversationId) return;
        initialLoadConversationRef.current = conversation.conversationId;
        void load();
    }, [conversation.conversationId, load]);

    const can = React.useCallback((permission: string) => (
        access?.permissions.includes(permission) ?? false
    ), [access]);
    const hasRoomManagement = Boolean(
        access?.owner || access?.permissions.some((permission) => ROOM_MANAGEMENT_PERMISSIONS.includes(permission)),
    );

    const assignedRoleIds = React.useMemo(
        () => new Set(members.flatMap((member) => member.roleIds ?? [])),
        [members],
    );

    const saveMemberRoles = async (member: ConversationMember, roleIds: string[]) => {
        setBusyKey(`roles:${member.userId}`);
        try {
            await assignConversationRoles(conversation.conversationId, member.userId, roleIds);
            setMembers((current) => current.map((item) => (
                item.userId === member.userId ? { ...item, roleIds } : item
            )));
            notifySuccess(localizeText('Đã cập nhật vai trò thành viên.'));
        } catch (error) {
            logger.error('[RoomManagementPanel] Role assignment failed', error instanceof Error ? error.message : String(error));
            notifyError(getUserFacingErrorMessage(error, localizeText('Không thể cập nhật vai trò thành viên.')));
        } finally {
            setBusyKey(null);
        }
    };

    const loadMoreMembers = React.useCallback(async () => {
        if (!memberCursor || !hasMoreMembers || busyKey !== null) return;
        if (memberPageRequestRef.current === memberCursor) return;
        const requestId = requestRef.current;
        const cursor = memberCursor;
        memberPageRequestRef.current = cursor;
        setBusyKey('load-more-members');
        try {
            const page = await getConversationMembers(conversation.conversationId, cursor, ROOM_MEMBER_PAGE_SIZE);
            if (requestId !== requestRef.current) return;
            setMembers((current) => {
                const existingIds = new Set(current.map((member) => member.userId));
                return [...current, ...page.content.filter((member) => !existingIds.has(member.userId))];
            });
            setMemberCursor(page.nextCursor);
            setHasMoreMembers(page.hasNext);
        } catch (error) {
            if (requestId !== requestRef.current) return;
            logger.error('[RoomManagementPanel] Member page load failed', error instanceof Error ? error.message : String(error));
            notifyError(getUserFacingErrorMessage(error, localizeText('Không thể tải thêm thành viên.')));
        } finally {
            if (memberPageRequestRef.current === cursor) memberPageRequestRef.current = null;
            if (requestId === requestRef.current) setBusyKey(null);
        }
    }, [busyKey, conversation.conversationId, hasMoreMembers, memberCursor]);

    const createRole = async (value: RoomRoleFormValue) => {
        if (!value.displayName || !/^[A-Z][A-Z0-9_]{1,31}$/.test(value.roleCode) || !/^#[0-9A-F]{6}$/.test(value.colorHex)) {
            notifyError(localizeText('Kiểm tra tên, mã và màu của vai trò.'));
            return;
        }
        setBusyKey('create-role');
        try {
            const created = await createConversationRole(conversation.conversationId, {
                ...value,
            });
            setRoles((current) => [...current, created].sort((left, right) => right.rolePosition - left.rolePosition));
            setShowRoleForm(false);
            notifySuccess(localizeText('Đã tạo vai trò mới.'));
        } catch (error) {
            logger.error('[RoomManagementPanel] Role creation failed', error instanceof Error ? error.message : String(error));
            notifyError(getUserFacingErrorMessage(error, localizeText('Không thể tạo vai trò.')));
        } finally {
            setBusyKey(null);
        }
    };

    const updateRole = async (role: ConversationRole, value: RoomRoleFormValue) => {
        setBusyKey(`update-role:${role.roleId}`);
        try {
            const updated = await updateConversationRole(conversation.conversationId, role.roleId, {
                displayName: value.displayName,
                colorHex: value.colorHex,
                permissionCodes: value.permissionCodes,
                isDefault: value.isDefault,
                rolePosition: value.rolePosition,
                expectedUpdatedAt: role.updatedAt,
            });
            setRoles((current) => current
                .map((item) => item.roleId === role.roleId ? updated : item)
                .sort((left, right) => right.rolePosition - left.rolePosition));
            setEditingRoleId(null);
            notifySuccess(localizeText('Đã cập nhật vai trò.'));
        } catch (error) {
            logger.error('[RoomManagementPanel] Role update failed', error instanceof Error ? error.message : String(error));
            notifyError(getUserFacingErrorMessage(error, localizeText('Không thể cập nhật vai trò.')));
        } finally {
            setBusyKey(null);
        }
    };

    const saveRoomChatPolicy = async (value: Pick<Conversation, 'chatMode' | 'slowModeSeconds'>) => {
        setBusyKey('room-chat-policy');
        try {
            await updateConversationChatPolicy(conversation.conversationId, value);
            updateStoredChatPolicy(conversation.conversationId, value);
            notifySuccess(localizeText('Đã cập nhật chính sách chat của phòng.'));
        } catch (error) {
            logger.error('[RoomManagementPanel] Room chat policy update failed', error instanceof Error ? error.message : String(error));
            notifyError(getUserFacingErrorMessage(error, localizeText('Không thể cập nhật chính sách chat của phòng.')));
        } finally {
            setBusyKey(null);
        }
    };

    const saveMemberChatPolicy = async (member: ConversationMember, value: RoomMemberPolicyValue) => {
        setBusyKey(`member-policy:${member.userId}`);
        try {
            await updateMemberChatPolicy(conversation.conversationId, member.userId, value);
            setMembers((current) => current.map((item) => item.userId === member.userId ? {
                ...item,
                mutedUntil: value.mutedUntil,
                messageIntervalSeconds: value.messageIntervalSeconds,
            } : item));
            notifySuccess(localizeText('Đã cập nhật chính sách chat của thành viên.'));
        } catch (error) {
            logger.error('[RoomManagementPanel] Member chat policy update failed', error instanceof Error ? error.message : String(error));
            notifyError(getUserFacingErrorMessage(error, localizeText('Không thể cập nhật chính sách chat của thành viên.')));
        } finally {
            setBusyKey(null);
        }
    };

    const confirmAction = async () => {
        if (!pendingAction) return;
        const action = pendingAction;
        const actionId = action.kind === 'delete-role'
            ? action.role.roleId
            : action.kind === 'unban'
                ? action.ban.userId
                : action.member.userId;
        if (action.kind === 'ban' && !banReason.trim()) {
            notifyError(localizeText('Hãy ghi lý do cấm thành viên.'));
            return;
        }
        setBusyKey(`${action.kind}:${actionId}`);
        try {
            if (action.kind === 'kick') {
                await removeConversationMember(conversation.conversationId, action.member.userId);
                setMembers((current) => current.filter((member) => member.userId !== action.member.userId));
                notifySuccess(localizeText('Đã xóa thành viên khỏi phòng.'));
            } else if (action.kind === 'ban') {
                const created = await banConversationMember(conversation.conversationId, action.member.userId, {
                    reasonCode: 'ROOM_POLICY',
                    reasonText: banReason.trim(),
                });
                setMembers((current) => current.filter((member) => member.userId !== action.member.userId));
                setBannedMembers((current) => [created, ...current.filter((ban) => ban.userId !== created.userId)]);
                setBanReason('');
            } else if (action.kind === 'unban') {
                await unbanConversationMember(conversation.conversationId, action.ban.userId);
                setBannedMembers((current) => current.filter((ban) => ban.userId !== action.ban.userId));
            } else if (action.kind === 'delete-role') {
                await deleteConversationRole(conversation.conversationId, action.role.roleId);
                setRoles((current) => current.filter((role) => role.roleId !== action.role.roleId));
                notifySuccess(localizeText('Đã xóa vai trò.'));
            } else {
                await transferConversationOwnership(conversation.conversationId, action.member.userId);
                updateConversationOwner(conversation.conversationId, action.member.userId);
                notifySuccess(localizeText('Đã chuyển quyền sở hữu phòng.'));
                await load();
            }
            setPendingAction(null);
        } catch (error) {
            logger.error('[RoomManagementPanel] Destructive action failed', error instanceof Error ? error.message : String(error));
            notifyError(getUserFacingErrorMessage(error, localizeText('Không thể hoàn tất thao tác.')));
        } finally {
            setBusyKey(null);
        }
    };

    const confirmation = React.useMemo(() => {
        if (!pendingAction) return null;
        switch (pendingAction.kind) {
            case 'kick':
                return {
                    title: localizeText('Xóa thành viên'),
                    description: localizeText('Thành viên sẽ mất quyền truy cập phòng cho đến khi được mời lại.'),
                    label: localizeText('Xóa'),
                };
            case 'ban':
                return {
                    title: localizeText('Cấm thành viên'),
                    description: localizeText('Thành viên sẽ bị đưa khỏi phòng và không thể quay lại bằng liên kết mời hay nút tham gia.'),
                    label: localizeText('Cấm khỏi phòng'),
                };
            case 'unban':
                return {
                    title: localizeText('Gỡ lệnh cấm'),
                    description: localizeText('Người này có thể được mời hoặc tự tham gia lại sau khi gỡ cấm.'),
                    label: localizeText('Gỡ cấm'),
                };
            case 'delete-role':
                return {
                    title: localizeText('Xóa vai trò'),
                    description: localizeText('Vai trò này sẽ bị xóa vĩnh viễn. Chỉ vai trò chưa được gán mới có thể xóa.'),
                    label: localizeText('Xóa'),
                };
            case 'transfer':
                return {
                    title: localizeText('Chuyển quyền sở hữu'),
                    description: localizeText('Bạn sẽ mất quyền chủ phòng ngay sau khi xác nhận. Thao tác này không thể tự hoàn tác.'),
                    label: localizeText('Chuyển quyền'),
                };
        }
    }, [pendingAction]);

    if (loading) {
        return (
            <section lang={locale} aria-label={localizeText('Quản lý phòng')} className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
            </section>
        );
    }

    if (loadError || !access) {
        return (
            <section lang={locale} className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-semibold text-destructive">{localizeText('Không thể tải thông tin phòng.')}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{localizeText('Dữ liệu thành viên và quyền chưa được thay đổi.')}</p>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
                    <RefreshCw className="h-4 w-4" /> {localizeText('Thử lại')}
                </Button>
            </section>
        );
    }

    return (
        <section lang={locale} className="space-y-4" aria-labelledby="room-management-title">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h4 id="room-management-title" className="text-sm font-bold">{localizeText('Thành viên')}</h4>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {hasRoomManagement
                            ? localizeText('Danh sách thành viên. Công cụ quản lý chỉ hiện theo quyền của bạn.')
                            : localizeText('Những người đang tham gia phòng này.')}
                    </p>
                </div>
                <Badge variant="outline" className="shrink-0">{conversation.memberCount}</Badge>
            </div>

            {hasRoomManagement ? (
                <p className="pt-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{localizeText('Quản lý phòng')}</p>
            ) : null}

            {can('ROOM_UPDATE') ? (
                <details className="group rounded-2xl border border-border/70">
                    <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span className="flex-1">{localizeText('Chính sách chat')}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-border/60 p-3">
                        <RoomChatPolicyForm
                            key={`${conversation.chatMode}:${conversation.slowModeSeconds}`}
                            initialValue={{
                                chatMode: conversation.chatMode,
                                slowModeSeconds: conversation.slowModeSeconds,
                            }}
                            loading={busyKey === 'room-chat-policy'}
                            disabled={busyKey !== null}
                            onSubmit={(value) => void saveRoomChatPolicy(value)}
                        />
                    </div>
                </details>
            ) : null}

            {can('ROOM_AUDIT_READ') ? (
                <details
                    className="group rounded-2xl border border-border/70"
                    onToggle={(event) => setAuditOpen(event.currentTarget.open)}
                >
                    <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                        <ScrollText className="h-4 w-4 text-primary" />
                        <span className="flex-1">{localizeText('Nhật ký phòng')}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    {auditOpen ? (
                        <div className="border-t border-border/60 p-3">
                            <RoomAuditTimeline conversationId={conversation.conversationId} />
                        </div>
                    ) : null}
                </details>
            ) : null}

            <RoomMemberDirectory
                conversationId={conversation.conversationId}
                members={members}
                roles={roles}
                access={access}
                currentUserId={currentUserId}
                busyKey={busyKey}
                hasMore={hasMoreMembers}
                onLoadMore={() => void loadMoreMembers()}
                onSaveRoles={saveMemberRoles}
                onSavePolicy={saveMemberChatPolicy}
                onKick={(member) => setPendingAction({ kind: 'kick', member })}
                onBan={(member) => { setBanReason(''); setPendingAction({ kind: 'ban', member }); }}
                onTransfer={(member) => setPendingAction({ kind: 'transfer', member })}
            />

            {can('MEMBER_BAN') ? (
                <details className="group rounded-2xl border border-border/70">
                    <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                        <Ban className="h-4 w-4 text-destructive" />
                        <span className="flex-1">{localizeText('Danh sách cấm')}</span>
                        <Badge variant="outline">{bannedMembers.length}</Badge>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-2 border-t border-border/60 p-3">
                        {bannedMembers.length === 0 ? (
                            <p className="py-2 text-xs text-muted-foreground">{localizeText('Phòng chưa cấm thành viên nào.')}</p>
                        ) : bannedMembers.map((ban) => (
                            <div key={ban.userId} className="flex items-start gap-3 rounded-xl bg-muted/45 p-3">
                                <Ban className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold">{ban.displayName}</p>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{ban.reasonText}</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" disabled={busyKey !== null} onClick={() => setPendingAction({ kind: 'unban', ban })}>
                                    <UserRoundCheck className="h-4 w-4" /> {localizeText('Gỡ cấm')}
                                </Button>
                            </div>
                        ))}
                    </div>
                </details>
            ) : null}

            {(can('ROLE_CREATE') || can('ROLE_UPDATE') || can('ROLE_DELETE')) ? (
                <details className="group rounded-2xl border border-border/70">
                    <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span className="flex-1">{localizeText('Vai trò của phòng')}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-3 border-t border-border/60 p-3">
                        {roles.filter((role) => !role.isSystem).map((role) => (
                            <div key={role.roleId} className="space-y-2">
                                <div className="flex items-center gap-2 rounded-xl bg-muted/45 p-2.5">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: role.colorHex }} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold">{role.displayName}</span>
                                        <span className="block truncate text-[11px] text-muted-foreground">{role.roleCode} · {role.permissions.length} {localizeText('quyền')}</span>
                                    </span>
                                    {can('ROLE_UPDATE') ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            disabled={busyKey !== null}
                                            aria-label={`${localizeText('Chỉnh sửa vai trò')} ${role.displayName}`}
                                            onClick={() => {
                                                setShowRoleForm(false);
                                                setEditingRoleId((current) => current === role.roleId ? null : role.roleId);
                                            }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    ) : null}
                                    {can('ROLE_DELETE') ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        disabled={busyKey !== null || hasMoreMembers || assignedRoleIds.has(role.roleId)}
                                        aria-label={localizeText('Xóa vai trò')}
                                        title={hasMoreMembers
                                            ? localizeText('Tải tất cả thành viên trước khi xóa vai trò.')
                                            : assignedRoleIds.has(role.roleId)
                                                ? localizeText('Gỡ vai trò khỏi mọi thành viên trước khi xóa.')
                                                : localizeText('Xóa vai trò')}
                                        onClick={() => setPendingAction({ kind: 'delete-role', role })}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                    ) : null}
                                </div>
                                {editingRoleId === role.roleId ? (
                                    <RoomRoleForm
                                        key={role.updatedAt}
                                        initialValue={{
                                            displayName: role.displayName,
                                            roleCode: role.roleCode,
                                            colorHex: role.colorHex,
                                            permissionCodes: role.permissions,
                                            isDefault: role.isDefault,
                                            rolePosition: role.rolePosition,
                                        }}
                                        editableRoleCode={false}
                                        availablePermissions={access.permissions}
                                        submitLabel={localizeText('Lưu thay đổi')}
                                        loading={busyKey === `update-role:${role.roleId}`}
                                        disabled={busyKey !== null}
                                        onSubmit={(value) => void updateRole(role, value)}
                                        onCancel={() => setEditingRoleId(null)}
                                    />
                                ) : null}
                            </div>
                        ))}

                        {can('ROLE_CREATE') && !showRoleForm ? (
                            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => {
                                setEditingRoleId(null);
                                setShowRoleForm(true);
                            }}>
                                <Plus className="h-4 w-4" /> {localizeText('Tạo vai trò')}
                            </Button>
                        ) : null}

                        {can('ROLE_CREATE') && showRoleForm ? (
                            <RoomRoleForm
                                initialValue={EMPTY_ROLE}
                                editableRoleCode
                                availablePermissions={access.permissions}
                                submitLabel={localizeText('Tạo vai trò')}
                                loading={busyKey === 'create-role'}
                                disabled={busyKey !== null}
                                onSubmit={(value) => void createRole(value)}
                                onCancel={() => setShowRoleForm(false)}
                            />
                        ) : null}
                    </div>
                </details>
            ) : null}

            <ConfirmDialog
                open={pendingAction !== null}
                onOpenChange={(open) => { if (!open && busyKey === null) setPendingAction(null); }}
                title={confirmation?.title ?? ''}
                description={confirmation?.description ?? ''}
                confirmLabel={confirmation?.label ?? ''}
                destructive
                loading={busyKey !== null}
                onConfirm={confirmAction}
            >
                {pendingAction?.kind === 'ban' ? (
                    <div>
                        <label htmlFor="room-ban-reason" className="mb-1.5 block text-xs font-semibold">{localizeText('Lý do cấm')}</label>
                        <Textarea id="room-ban-reason" value={banReason} maxLength={500} autoFocus onChange={(event) => setBanReason(event.target.value)} placeholder={localizeText('Ghi ngắn gọn để những người quản lý khác hiểu quyết định này.')} />
                    </div>
                ) : null}
            </ConfirmDialog>
        </section>
    );
}
