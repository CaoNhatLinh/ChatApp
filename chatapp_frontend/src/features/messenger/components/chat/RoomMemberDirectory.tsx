import * as React from 'react';
import { ChevronDown, Crown, UserMinus } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import type { ConversationMember } from '@/features/messenger/types/messenger.types';
import type { ConversationPermissionsView, ConversationRole } from '@/features/messenger/api/messenger.api';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { localizeText } from '@/shared/i18n';
import { RoomMemberPolicyForm, type RoomMemberPolicyValue } from './RoomMemberPolicyForm';
import { usePresence } from '@/features/presence/model/presence.store';
import { useTrackPresenceInViewport } from '@/features/presence/hooks/useTrackPresence';
import { StatusDot } from '@/features/presence/ui/StatusSelector';

const VIRTUALIZATION_THRESHOLD = 50;

interface MemberListContext {
  hasMore: boolean;
  loading: boolean;
  disabled: boolean;
  onLoadMore: () => void;
}

function MemberListFooter({ context }: { context: MemberListContext }) {
  if (!context.hasMore) return null;
  return (
    <div className="pb-1 pt-1">
      <Button type="button" variant="outline" size="sm" className="w-full" loading={context.loading} disabled={context.disabled} onClick={context.onLoadMore}>
        {localizeText('Tải thêm thành viên')}
      </Button>
    </div>
  );
}

const MEMBER_LIST_COMPONENTS = { Footer: MemberListFooter };

interface RoomMemberDirectoryProps {
  conversationId: string;
  members: ConversationMember[];
  roles: ConversationRole[];
  access: ConversationPermissionsView;
  currentUserId?: string;
  busyKey: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onSaveRoles: (member: ConversationMember, roleIds: string[]) => Promise<void>;
  onSavePolicy: (member: ConversationMember, value: RoomMemberPolicyValue) => Promise<void>;
  onKick: (member: ConversationMember) => void;
  onTransfer: (member: ConversationMember) => void;
}

interface RoomMemberRowProps {
  member: ConversationMember;
  conversationId: string;
  roles: ConversationRole[];
  access: ConversationPermissionsView;
  currentUserId?: string;
  busyKey: string | null;
  expanded: boolean;
  onExpandedChange: (memberId: string, expanded: boolean) => void;
  onSaveRoles: RoomMemberDirectoryProps['onSaveRoles'];
  onSavePolicy: RoomMemberDirectoryProps['onSavePolicy'];
  onKick: RoomMemberDirectoryProps['onKick'];
  onTransfer: RoomMemberDirectoryProps['onTransfer'];
}

function RoomMemberPresence({ userId, conversationId }: { userId: string; conversationId: string }) {
  const presenceRef = useTrackPresenceInViewport<HTMLSpanElement>([userId], conversationId);
  const { presence } = usePresence(userId);
  return presence ? (
    <span ref={presenceRef} className="inline-flex shrink-0">
      <StatusDot status={presence.status} isOnline={presence.isOnline} size="sm" />
    </span>
  ) : <span ref={presenceRef} className="inline-flex h-2.5 w-2.5 shrink-0" aria-hidden="true" />;
}

function VisibleRoleBadges({ roles, isOwner }: { roles: ConversationRole[]; isOwner: boolean }) {
  const visibleRole = roles.find((role) => !role.isSystem);
  const hiddenRoleCount = roles.filter((role) => !role.isSystem).length - (visibleRole ? 1 : 0);
  return (
    <span className="mt-1 flex items-center gap-1">
      {isOwner ? <Badge className="gap-1 bg-amber-500 text-white"><Crown className="h-3 w-3" />{localizeText('Chủ phòng')}</Badge> : null}
      {visibleRole ? <Badge variant="outline" style={{ borderColor: visibleRole.colorHex, color: visibleRole.colorHex }}>{visibleRole.displayName}</Badge> : null}
      {hiddenRoleCount > 0 ? <span className="text-[11px] text-muted-foreground">+{hiddenRoleCount}</span> : null}
    </span>
  );
}

interface RoomMemberSummaryProps {
  member: ConversationMember;
  conversationId: string;
  memberRoles: ConversationRole[];
  isOwner: boolean;
  isSelf: boolean;
  showChevron: boolean;
}

function RoomMemberSummary({ member, conversationId, memberRoles, isOwner, isSelf, showChevron }: RoomMemberSummaryProps) {
  return (
    <>
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={member.avatarUrl} alt="" />
        <AvatarFallback>{member.displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
          {member.displayName}
          {isSelf ? <span className="text-xs font-normal text-muted-foreground">({localizeText('Bạn')})</span> : null}
        </span>
        <VisibleRoleBadges roles={memberRoles} isOwner={isOwner} />
      </span>
      <RoomMemberPresence userId={member.userId} conversationId={conversationId} />
      {showChevron ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /> : null}
    </>
  );
}

function RoomMemberRow({
  member,
  conversationId,
  roles,
  access,
  currentUserId,
  busyKey,
  expanded,
  onExpandedChange,
  onSaveRoles,
  onSavePolicy,
  onKick,
  onTransfer,
}: RoomMemberRowProps) {
  const memberRoles = member.roleIds.map((roleId) => roles.find((role) => role.roleId === roleId)).filter(Boolean) as ConversationRole[];
  const isOwner = member.role === 'owner';
  const isSelf = member.userId === currentUserId;
  const canAssignRoles = access.permissions.includes('ROLE_ASSIGN');
  const canKick = access.permissions.includes('MEMBER_KICK');
  const canMute = access.permissions.includes('MEMBER_MUTE');
  const hasMemberActions = !isOwner && (canAssignRoles || canKick || canMute || access.owner);

  if (!hasMemberActions) {
    return (
      <div data-room-member-id={member.userId} className="rounded-2xl border border-border/70 bg-card/55">
        <div className="flex items-center gap-3 p-3">
          <RoomMemberSummary
            member={member}
            conversationId={conversationId}
            memberRoles={memberRoles}
            isOwner={isOwner}
            isSelf={isSelf}
            showChevron={false}
          />
        </div>
      </div>
    );
  }

  return (
    <details
      data-room-member-id={member.userId}
      open={expanded}
      onToggle={(event) => onExpandedChange(member.userId, event.currentTarget.open)}
      className="group rounded-2xl border border-border/70 bg-card/55 open:border-primary/30"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <RoomMemberSummary
          member={member}
          conversationId={conversationId}
          memberRoles={memberRoles}
          isOwner={isOwner}
          isSelf={isSelf}
          showChevron
        />
      </summary>

      <div className="space-y-3 border-t border-border/60 p-3">
          {canAssignRoles ? (
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
                      onClick={() => void onSaveRoles(
                        member,
                        selected ? member.roleIds.filter((roleId) => roleId !== role.roleId) : [...member.roleIds, role.roleId],
                      )}
                      className={selected
                        ? 'rounded-full border border-primary bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40'
                        : 'rounded-full border border-border px-2.5 py-1 text-xs font-semibold transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-40'}
                    >
                      {role.displayName}
                    </button>
                  );
                })}
                {roles.every((role) => role.isSystem) ? <span className="text-xs text-muted-foreground">{localizeText('Chưa có vai trò tùy chỉnh.')}</span> : null}
              </div>
            </div>
          ) : null}

          {canMute && !isSelf ? (
            <div>
              <p className="mb-2 text-xs font-semibold">{localizeText('Chính sách chat của thành viên')}</p>
              <RoomMemberPolicyForm
                key={`${member.mutedUntil}:${member.messageIntervalSeconds}`}
                initialMutedUntil={member.mutedUntil}
                initialMessageIntervalSeconds={member.messageIntervalSeconds}
                loading={busyKey === `member-policy:${member.userId}`}
                disabled={busyKey !== null}
                onSubmit={(value) => void onSavePolicy(member, value)}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {access.owner ? (
              <Button type="button" variant="outline" size="sm" disabled={busyKey !== null} onClick={() => onTransfer(member)}>
                <Crown className="h-4 w-4" /> {localizeText('Chuyển quyền chủ phòng')}
              </Button>
            ) : null}
            {canKick && !isSelf ? (
              <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busyKey !== null} onClick={() => onKick(member)}>
                <UserMinus className="h-4 w-4" /> {localizeText('Xóa khỏi phòng')}
              </Button>
            ) : null}
          </div>
      </div>
    </details>
  );
}

export function RoomMemberDirectory(props: RoomMemberDirectoryProps) {
  const {
    conversationId,
    members,
    roles,
    access,
    currentUserId,
    busyKey,
    hasMore,
    onLoadMore,
    onSaveRoles,
    onSavePolicy,
    onKick,
    onTransfer,
  } = props;
  const [expandedMemberId, setExpandedMemberId] = React.useState<string | null>(null);
  const shouldVirtualize = hasMore || members.length > VIRTUALIZATION_THRESHOLD;
  const memberListContext = React.useMemo<MemberListContext>(() => ({
    hasMore,
    loading: busyKey === 'load-more-members',
    disabled: busyKey !== null,
    onLoadMore,
  }), [busyKey, hasMore, onLoadMore]);

  const handleExpandedChange = React.useCallback((memberId: string, expanded: boolean) => {
    setExpandedMemberId((current) => expanded ? memberId : current === memberId ? null : current);
  }, []);

  const renderMember = React.useCallback((member: ConversationMember) => (
    <RoomMemberRow
      member={member}
      conversationId={conversationId}
      roles={roles}
      access={access}
      currentUserId={currentUserId}
      busyKey={busyKey}
      expanded={expandedMemberId === member.userId}
      onExpandedChange={handleExpandedChange}
      onSaveRoles={onSaveRoles}
      onSavePolicy={onSavePolicy}
      onKick={onKick}
      onTransfer={onTransfer}
    />
  ), [access, busyKey, conversationId, currentUserId, expandedMemberId, handleExpandedChange, onKick, onSavePolicy, onSaveRoles, onTransfer, roles]);

  if (members.length === 0) {
    return <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">{localizeText('Phòng chưa có thành viên.')}</p>;
  }

  return (
    <div className="space-y-2">
      {shouldVirtualize ? (
        <Virtuoso
          aria-label={localizeText('Danh sách thành viên')}
          className="pr-1"
          style={{ height: 'min(70vh, 36rem)' }}
          components={MEMBER_LIST_COMPONENTS}
          context={memberListContext}
          data={members}
          computeItemKey={(_, member) => member.userId}
          increaseViewportBy={160}
          endReached={() => { if (hasMore && busyKey === null) onLoadMore(); }}
          itemContent={(_, member) => <div className="pb-2">{renderMember(member)}</div>}
        />
      ) : (
        <div className="space-y-2">
          {members.map((member) => <React.Fragment key={member.userId}>{renderMember(member)}</React.Fragment>)}
        </div>
      )}
    </div>
  );
}
