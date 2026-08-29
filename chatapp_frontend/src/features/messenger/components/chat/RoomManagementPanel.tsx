import * as React from 'react';
import { ChevronDown, Crown, Pencil, Plus, RefreshCw, ScrollText, ShieldCheck, Trash2, UserMinus } from 'lucide-react';
import type { Conversation, ConversationMember } from '@/features/messenger/types/messenger.types';
import {
    assignConversationRoles,
    createConversationRole,
    deleteConversationRole,
    getConversationMembers,
    getConversationPermissions,
    listConversationRoles,
    removeConversationMember,
    transferConversationOwnership,
    updateConversationChatPolicy,
    updateMemberChatPolicy,
    updateConversationRole,
    type ConversationPermissionsView,
    type ConversationRole,
} from '@/features/messenger/api/messenger.api';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useMessengerStore } from '@/features/messenger/model/messenger.store';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Skeleton } from '@/shared/ui/Skeleton';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { logger } from '@/shared/lib/logger';
import { notifyError, notifySuccess } from '@/shared/lib/notification';
import { cn } from '@/shared/lib/cn';
import { RoomRoleForm, type RoomRoleFormValue } from './RoomRoleForm';
import { RoomChatPolicyForm } from './RoomChatPolicyForm';
import { RoomMemberPolicyForm, type RoomMemberPolicyValue } from './RoomMemberPolicyForm';
import { RoomAuditTimeline } from './RoomAuditTimeline';

const EMPTY_ROLE: RoomRoleFormValue = {
    displayName: '',
    roleCode: '',
    colorHex: '#4F46E5',
    permissionCodes: [],
    isDefault: false,
    rolePosition: 100,
};

type PendingAction =
    | { kind: 'kick'; member: ConversationMember }
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
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState(false);
    const [busyKey, setBusyKey] = React.useState<string | null>(null);
    const [pendingAction, setPendingAction] = React.useState<PendingAction>(null);
    const [showRoleForm, setShowRoleForm] = React.useState(false);
    const [editingRoleId, setEditingRoleId] = React.useState<string | null>(null);
    const [auditOpen, setAuditOpen] = React.useState(false);
    const requestRef = React.useRef(0);

    const load = React.useCallback(async () => {
        const requestId = ++requestRef.current;
        setLoading(true);
        setLoadError(false);
        try {
            const [memberPage, nextRoles, nextAccess] = await Promise.all([
                getConversationMembers(conversation.conversationId),
                listConversationRoles(conversation.conversationId),
                getConversationPermissions(conversation.conversationId),
            ]);
            if (requestId !== requestRef.current) return;
            setMembers(memberPage.content);
            setMemberCursor(memberPage.nextCursor);
            setHasMoreMembers(memberPage.hasNext);
            setRoles(nextRoles);
            setAccess(nextAccess);
        } catch (error) {
            if (requestId !== requestRef.current) return;
            setLoadError(true);
            logger.error('[RoomManagementPanel] Load failed', error instanceof Error ? error.message : String(error));
        } finally {
            if (requestId === requestRef.current) setLoading(false);
        }
    }, [conversation.conversationId]);

    React.useEffect(() => {
        void load();
        return () => {
            requestRef.current += 1;
        };
    }, [load]);

    const can = React.useCallback((permission: string) => (
        access?.permissions.includes(permission) ?? false
    ), [access]);

    const roleById = React.useMemo(() => new Map(roles.map((role) => [role.roleId, role])), [roles]);
    const assignedRoleIds = React.useMemo(
        () => new Set(members.flatMap((member) => member.roleIds)),
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

    const loadMoreMembers = async () => {
        if (!memberCursor || !hasMoreMembers) return;
        setBusyKey('load-more-members');
        try {
            const page = await getConversationMembers(conversation.conversationId, memberCursor);
            setMembers((current) => [...current, ...page.content]);
            setMemberCursor(page.nextCursor);
            setHasMoreMembers(page.hasNext);
        } catch (error) {
            logger.error('[RoomManagementPanel] Member page load failed', error instanceof Error ? error.message : String(error));
            notifyError(getUserFacingErrorMessage(error, localizeText('Không thể tải thêm thành viên.')));
        } finally {
            setBusyKey(null);
        }
    };

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
        setBusyKey(`${action.kind}:${action.kind === 'delete-role' ? action.role.roleId : action.member.userId}`);
        try {
            if (action.kind === 'kick') {
                await removeConversationMember(conversation.conversationId, action.member.userId);
                setMembers((current) => current.filter((member) => member.userId !== action.member.userId));
                notifySuccess(localizeText('Đã xóa thành viên khỏi phòng.'));
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

    const confirmation = pendingAction ? {
        title: pendingAction.kind === 'kick'
            ? localizeText('Xóa thành viên')
            : pendingAction.kind === 'delete-role'
                ? localizeText('Xóa vai trò')
                : localizeText('Chuyển quyền sở hữu'),
        description: pendingAction.kind === 'kick'
            ? localizeText('Thành viên sẽ mất quyền truy cập phòng cho đến khi được mời lại.')
            : pendingAction.kind === 'delete-role'
                ? localizeText('Vai trò này sẽ bị xóa vĩnh viễn. Chỉ vai trò chưa được gán mới có thể xóa.')
                : localizeText('Bạn sẽ mất quyền chủ phòng ngay sau khi xác nhận. Thao tác này không thể tự hoàn tác.'),
        label: pendingAction.kind === 'transfer' ? localizeText('Chuyển quyền') : localizeText('Xóa'),
    } : null;

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
                <p className="text-sm font-semibold text-destructive">{localizeText('Không thể tải công cụ quản lý phòng.')}</p>
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
                    <h4 id="room-management-title" className="text-sm font-bold">{localizeText('Thành viên & vai trò')}</h4>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {localizeText('Quản lý quyền theo vai trò của phòng. Thay đổi được áp dụng ngay.')}
                    </p>
                </div>
                <Badge variant="outline" className="shrink-0">{conversation.memberCount}</Badge>
            </div>

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

            <div className="space-y-2">
                {members.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                        {localizeText('Phòng chưa có thành viên.')}
                    </p>
                ) : members.map((member) => {
                    const memberRoles = member.roleIds.map((roleId) => roleById.get(roleId)).filter(Boolean) as ConversationRole[];
                    const isOwner = member.role === 'owner';
                    const isSelf = member.userId === currentUserId;
                    return (
                        <details key={member.userId} className="group rounded-2xl border border-border/70 bg-card/55 open:border-primary/30">
                            <summary className="flex cursor-pointer list-none items-center gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                                <Avatar className="h-9 w-9 shrink-0">
                                    <AvatarImage src={member.avatarUrl} alt="" />
                                    <AvatarFallback>{member.displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
                                        {member.displayName}
                                        {isSelf ? <span className="text-xs font-normal text-muted-foreground">({localizeText('Bạn')})</span> : null}
                                    </span>
                                    <span className="mt-1 flex flex-wrap gap-1">
                                        {isOwner ? <Badge className="gap-1 bg-amber-500 text-white"><Crown className="h-3 w-3" />{localizeText('Chủ phòng')}</Badge> : null}
                                        {memberRoles.filter((role) => !role.isSystem).map((role) => (
                                            <Badge key={role.roleId} variant="outline" style={{ borderColor: role.colorHex, color: role.colorHex }}>{role.displayName}</Badge>
                                        ))}
                                    </span>
                                </span>
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                            </summary>
                            {!isOwner && (can('ROLE_ASSIGN') || can('MEMBER_KICK') || can('MEMBER_MUTE') || access.owner) ? (
                                <div className="space-y-3 border-t border-border/60 p-3">
                                    {can('ROLE_ASSIGN') ? (
                                        <div>
                                            <p className="mb-2 text-xs font-semibold">{localizeText('Vai trò được gán')}</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {roles.filter((role) => !role.isSystem).map((role) => {
                                                    const selected = member.roleIds.includes(role.roleId);
                                                    const assignable = role.permissions.every((permission) => access.permissions.includes(permission));
                                                    return (
                                                        <button
                                                            key={role.roleId}
                                                            type="button"
                                                            aria-pressed={selected}
                                                            disabled={busyKey !== null || (!selected && !assignable)}
                                                            title={!selected && !assignable ? localizeText('Vai trò có quyền cao hơn quyền của bạn.') : undefined}
                                                            onClick={() => void saveMemberRoles(
                                                                member,
                                                                selected
                                                                    ? member.roleIds.filter((roleId) => roleId !== role.roleId)
                                                                    : [...member.roleIds, role.roleId],
                                                            )}
                                                            className={cn(
                                                                'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                                                                selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50',
                                                            )}
                                                        >
                                                            {role.displayName}
                                                        </button>
                                                    );
                                                })}
                                                {roles.every((role) => role.isSystem) ? <span className="text-xs text-muted-foreground">{localizeText('Chưa có vai trò tùy chỉnh.')}</span> : null}
                                            </div>
                                        </div>
                                    ) : null}
                                    {can('MEMBER_MUTE') && !isSelf ? (
                                        <div>
                                            <p className="mb-2 text-xs font-semibold">{localizeText('Chính sách chat của thành viên')}</p>
                                            <RoomMemberPolicyForm
                                                key={`${member.mutedUntil}:${member.messageIntervalSeconds}`}
                                                initialMutedUntil={member.mutedUntil}
                                                initialMessageIntervalSeconds={member.messageIntervalSeconds}
                                                loading={busyKey === `member-policy:${member.userId}`}
                                                disabled={busyKey !== null}
                                                onSubmit={(value) => void saveMemberChatPolicy(member, value)}
                                            />
                                        </div>
                                    ) : null}
                                    <div className="flex flex-wrap gap-2">
                                        {access.owner ? (
                                            <Button type="button" variant="outline" size="sm" disabled={busyKey !== null} onClick={() => setPendingAction({ kind: 'transfer', member })}>
                                                <Crown className="h-4 w-4" /> {localizeText('Chuyển quyền chủ phòng')}
                                            </Button>
                                        ) : null}
                                        {can('MEMBER_KICK') && !isSelf ? (
                                            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busyKey !== null} onClick={() => setPendingAction({ kind: 'kick', member })}>
                                                <UserMinus className="h-4 w-4" /> {localizeText('Xóa khỏi phòng')}
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}
                        </details>
                    );
                })}
                {hasMoreMembers ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        loading={busyKey === 'load-more-members'}
                        disabled={busyKey !== null}
                        onClick={() => void loadMoreMembers()}
                    >
                        {localizeText('Tải thêm thành viên')}
                    </Button>
                ) : null}
            </div>

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
            />
        </section>
    );
}
