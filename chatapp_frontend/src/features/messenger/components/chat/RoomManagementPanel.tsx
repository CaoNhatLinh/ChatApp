import * as React from 'react';
import { ChevronDown, Crown, Plus, RefreshCw, ShieldCheck, Trash2, UserMinus } from 'lucide-react';
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
    type ConversationPermissionsView,
    type ConversationRole,
} from '@/features/messenger/api/messenger.api';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useMessengerStore } from '@/features/messenger/model/messenger.store';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Input } from '@/shared/ui/Input';
import { Skeleton } from '@/shared/ui/Skeleton';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { logger } from '@/shared/lib/logger';
import { notifyError, notifySuccess } from '@/shared/lib/notification';
import { cn } from '@/shared/lib/cn';

const PERMISSIONS = [
    ['MESSAGE_SEND', 'Gửi tin nhắn'],
    ['MESSAGE_EDIT_OWN', 'Sửa tin nhắn của mình'],
    ['MESSAGE_DELETE_OWN', 'Xóa tin nhắn của mình'],
    ['MESSAGE_DELETE_ANY', 'Xóa mọi tin nhắn'],
    ['MESSAGE_PIN', 'Ghim tin nhắn'],
    ['POLL_CREATE', 'Tạo bình chọn'],
    ['POLL_MANAGE', 'Quản lý bình chọn'],
    ['MEMBER_INVITE', 'Mời thành viên'],
    ['MEMBER_KICK', 'Xóa thành viên'],
    ['MEMBER_BAN', 'Cấm thành viên'],
    ['MEMBER_MUTE', 'Tắt tiếng thành viên'],
    ['ROLE_CREATE', 'Tạo vai trò'],
    ['ROLE_UPDATE', 'Chỉnh sửa vai trò'],
    ['ROLE_DELETE', 'Xóa vai trò'],
    ['ROLE_ASSIGN', 'Gán vai trò'],
    ['ROOM_UPDATE', 'Chỉnh sửa phòng'],
    ['INVITE_MANAGE', 'Quản lý lời mời'],
    ['CALL_START', 'Bắt đầu cuộc gọi'],
    ['CALL_MODERATE', 'Điều phối cuộc gọi'],
    ['ROOM_AUDIT_READ', 'Xem nhật ký phòng'],
] as const;

interface RoleDraft {
    displayName: string;
    roleCode: string;
    colorHex: string;
    permissionCodes: string[];
    isDefault: boolean;
}

const EMPTY_ROLE: RoleDraft = {
    displayName: '',
    roleCode: '',
    colorHex: '#4F46E5',
    permissionCodes: [],
    isDefault: false,
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
    const [members, setMembers] = React.useState<ConversationMember[]>([]);
    const [roles, setRoles] = React.useState<ConversationRole[]>([]);
    const [access, setAccess] = React.useState<ConversationPermissionsView | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState(false);
    const [busyKey, setBusyKey] = React.useState<string | null>(null);
    const [pendingAction, setPendingAction] = React.useState<PendingAction>(null);
    const [draft, setDraft] = React.useState<RoleDraft>(EMPTY_ROLE);
    const [showRoleForm, setShowRoleForm] = React.useState(false);
    const requestRef = React.useRef(0);

    const load = React.useCallback(async () => {
        const requestId = ++requestRef.current;
        setLoading(true);
        setLoadError(false);
        try {
            const [nextMembers, nextRoles, nextAccess] = await Promise.all([
                getConversationMembers(conversation.conversationId),
                listConversationRoles(conversation.conversationId),
                getConversationPermissions(conversation.conversationId),
            ]);
            if (requestId !== requestRef.current) return;
            setMembers(nextMembers);
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

    const createRole = async (event: React.FormEvent) => {
        event.preventDefault();
        const displayName = draft.displayName.trim();
        const roleCode = draft.roleCode.trim().toUpperCase();
        if (!displayName || !/^[A-Z][A-Z0-9_]{1,31}$/.test(roleCode) || !/^#[0-9A-Fa-f]{6}$/.test(draft.colorHex)) {
            notifyError(localizeText('Kiểm tra tên, mã và màu của vai trò.'));
            return;
        }
        setBusyKey('create-role');
        try {
            const created = await createConversationRole(conversation.conversationId, {
                ...draft,
                displayName,
                roleCode,
                colorHex: draft.colorHex.toUpperCase(),
            });
            setRoles((current) => [...current, created].sort((left, right) => left.rolePosition - right.rolePosition));
            setDraft(EMPTY_ROLE);
            setShowRoleForm(false);
            notifySuccess(localizeText('Đã tạo vai trò mới.'));
        } catch (error) {
            logger.error('[RoomManagementPanel] Role creation failed', error instanceof Error ? error.message : String(error));
            notifyError(getUserFacingErrorMessage(error, localizeText('Không thể tạo vai trò.')));
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
                <Badge variant="outline" className="shrink-0">{members.length}</Badge>
            </div>

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
                            {!isOwner && (can('ROLE_ASSIGN') || can('MEMBER_KICK') || access.owner) ? (
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
            </div>

            {(can('ROLE_CREATE') || can('ROLE_DELETE')) ? (
                <details className="group rounded-2xl border border-border/70">
                    <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span className="flex-1">{localizeText('Vai trò của phòng')}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-3 border-t border-border/60 p-3">
                        {roles.filter((role) => !role.isSystem).map((role) => (
                            <div key={role.roleId} className="flex items-center gap-2 rounded-xl bg-muted/45 p-2.5">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: role.colorHex }} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold">{role.displayName}</span>
                                    <span className="block truncate text-[11px] text-muted-foreground">{role.roleCode} · {role.permissions.length} {localizeText('quyền')}</span>
                                </span>
                                {can('ROLE_DELETE') ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        disabled={busyKey !== null || assignedRoleIds.has(role.roleId)}
                                        aria-label={localizeText('Xóa vai trò')}
                                        title={assignedRoleIds.has(role.roleId) ? localizeText('Gỡ vai trò khỏi mọi thành viên trước khi xóa.') : localizeText('Xóa vai trò')}
                                        onClick={() => setPendingAction({ kind: 'delete-role', role })}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                ) : null}
                            </div>
                        ))}

                        {can('ROLE_CREATE') && !showRoleForm ? (
                            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setShowRoleForm(true)}>
                                <Plus className="h-4 w-4" /> {localizeText('Tạo vai trò')}
                            </Button>
                        ) : null}

                        {can('ROLE_CREATE') && showRoleForm ? (
                            <form className="space-y-3 rounded-xl bg-muted/35 p-3" onSubmit={createRole}>
                                <div className="grid grid-cols-[1fr_44px] gap-2">
                                    <Input
                                        aria-label={localizeText('Tên vai trò')}
                                        placeholder={localizeText('Tên vai trò')}
                                        maxLength={64}
                                        value={draft.displayName}
                                        onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
                                    />
                                    <input
                                        type="color"
                                        aria-label={localizeText('Màu vai trò')}
                                        className="h-10 w-11 cursor-pointer rounded-lg border border-border bg-background p-1"
                                        value={draft.colorHex}
                                        onChange={(event) => setDraft((current) => ({ ...current, colorHex: event.target.value }))}
                                    />
                                </div>
                                <Input
                                    aria-label={localizeText('Mã vai trò')}
                                    placeholder={localizeText('Mã vai trò, ví dụ MODERATOR')}
                                    maxLength={32}
                                    pattern="[A-Za-z][A-Za-z0-9_]{1,31}"
                                    value={draft.roleCode}
                                    onChange={(event) => setDraft((current) => ({ ...current, roleCode: event.target.value.toUpperCase() }))}
                                />
                                <fieldset>
                                    <legend className="mb-2 text-xs font-semibold">{localizeText('Quyền của vai trò')}</legend>
                                    <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-2">
                                        {PERMISSIONS.filter(([code]) => access.permissions.includes(code)).map(([code, label]) => (
                                            <label key={code} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/60">
                                                <input
                                                    type="checkbox"
                                                    checked={draft.permissionCodes.includes(code)}
                                                    onChange={(event) => setDraft((current) => ({
                                                        ...current,
                                                        permissionCodes: event.target.checked
                                                            ? [...current.permissionCodes, code]
                                                            : current.permissionCodes.filter((permission) => permission !== code),
                                                    }))}
                                                />
                                                {localizeText(label)}
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                                <label className="flex items-start gap-2 text-xs leading-5">
                                    <input
                                        type="checkbox"
                                        className="mt-1"
                                        checked={draft.isDefault}
                                        onChange={(event) => setDraft((current) => ({ ...current, isDefault: event.target.checked }))}
                                    />
                                    <span><strong>{localizeText('Vai trò mặc định')}</strong><br />{localizeText('Tự động gán cho thành viên mới.')}</span>
                                </label>
                                <div className="flex gap-2">
                                    <Button type="submit" size="sm" loading={busyKey === 'create-role'}>{localizeText('Tạo vai trò')}</Button>
                                    <Button type="button" variant="ghost" size="sm" disabled={busyKey !== null} onClick={() => { setShowRoleForm(false); setDraft(EMPTY_ROLE); }}>{localizeText('Hủy')}</Button>
                                </div>
                            </form>
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
