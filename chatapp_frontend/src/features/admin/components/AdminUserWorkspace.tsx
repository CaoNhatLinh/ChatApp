import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Shield } from 'lucide-react';
import type { UserDTO } from '@/entities/user/model/user.types';
import { useAppLocale } from '@/shared/i18n';
import { Badge, Button, ConfirmDialog, Input, Skeleton } from '@/shared/ui';
import { getAdminOverview, grantAdminRole, revokeAdminDevice, revokeAdminRole, revokeAdminSession, updateAdminUserStatus } from '../api/admin.api';
import type { AdminOverview } from '../api/admin.api';
import { useAdminUsers, userStatusLabel } from '../model/useAdminUsers';
import type { UserAction, UserExitState } from '../model/useAdminUsers';
import { AdminUserActionDialog } from './AdminUserActionDialog';
import type { UserActionValues } from './AdminUserActionDialog';
import { AdminUserDetail, AdminUserPortrait } from './AdminUserDetail';
import { AdminDirectoryArt } from './AdminDirectoryArt';

interface PendingAction { id: number; action: UserAction; user: UserDTO; roles: string[] }
export function AdminUserWorkspace({ overview: initialOverview, onExitState, onSanctions }: {
  overview: AdminOverview; onExitState: (state: UserExitState) => void; onSanctions: (userId: string) => void;
}) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [overview, setOverview] = useState(initialOverview);
  const data = useAdminUsers(overview.actorId);
  const [pending, setPending] = useState<PendingAction | null>(null), [open, setOpen] = useState(false);
  const [exit, setExit] = useState<UserExitState>({ draft: false, busy: false, uncertain: false });
  const [confirmation, setConfirmation] = useState(false), [feedback, setFeedback] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [recovering, setRecovering] = useState(false), [recoveryError, setRecoveryError] = useState(false);
  const recoveryGeneration = useRef(0), recoveryInFlight = useRef(false);
  useEffect(() => () => { ++recoveryGeneration.current; }, []);
  const navigation = useRef<(() => void) | null>(null), operation = useRef(false);
  const editorSequence = useRef(0);
  const trigger = useRef<HTMLElement | null>(null), search = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLHeadingElement | null>(null);
  const updateExit = useCallback((state: UserExitState) => { setExit(state); onExitState(state); }, [onExitState]);
  const canRead = overview.permissions.includes('USER_READ');
  const busy = exit.busy || operation.current;
  async function recoverAccess() {
    if (recoveryInFlight.current || !data.currentActor()) return;
    recoveryInFlight.current = true;
    const generation = ++recoveryGeneration.current, actorId = overview.actorId;
    setRecovering(true); setRecoveryError(false); data.reset();
    setPending(null); setOpen(false); setFeedback(null); trigger.current = null;
    try {
      const fresh = await getAdminOverview();
      if (generation !== recoveryGeneration.current || !data.currentActor()) return;
      if (fresh.actorId !== actorId) throw new Error('Admin authority actor changed');
      setOverview(fresh); setDenied(false);
    } catch {
      if (generation === recoveryGeneration.current && data.currentActor()) setRecoveryError(true);
    } finally {
      if (generation === recoveryGeneration.current) { recoveryInFlight.current = false; setRecovering(false); }
    }
  }
  function guard(next: () => void) {
    if (operation.current || exit.busy) return;
    if (exit.draft || exit.uncertain) { navigation.current = next; setConfirmation(true); }
    else { setPending(null); next(); }
  }
  function choose(candidate: UserDTO | null) {
    guard(() => {
      setOpen(false); setPending(null); setFeedback(null); data.select(candidate);
      if (!candidate) requestAnimationFrame(() => search.current?.focus());
    });
  }
  function edit(action: UserAction, button: HTMLButtonElement) {
    if (!data.selected || denied) return;
    const user = data.selected;
    guard(() => {
      trigger.current = button;
      const assigned = new Set(data.resources.roles?.map(role => role.roleCode));
      setPending({ id: ++editorSequence.current, action, user: { ...user }, roles: overview.availableRoleCodes.filter(code => !assigned.has(code)) });
      setOpen(true); setFeedback(null);
    });
  }
  async function commit(values: UserActionValues) {
    if (!pending || operation.current || !data.currentActor() || data.selected?.userId !== pending.user.userId) throw new Error('User action scope changed');
    const { action, user } = pending;
    const permission = action.kind === 'grant' || action.kind === 'role' ? 'APP_ROLE_MANAGE'
      : action.kind === 'status' ? values.status === 'ACTIVE' ? 'USER_RESTORE' : 'USER_SUSPEND' : 'SESSION_REVOKE';
    if (!overview.permissions.includes(permission) || denied) throw new Error('Permission unavailable');
    operation.current = true;
    try {
      switch (action.kind) {
        case 'grant': await grantAdminRole(user.userId, values.role, values.reason, values.expiresAt); break;
        case 'status': await updateAdminUserStatus(user.userId, values.status, values.reason); break;
        case 'role': await revokeAdminRole(user.userId, action.role.roleCode, values.reason); break;
        case 'session': await revokeAdminSession(user.userId, action.session.tokenId, values.reason); break;
        case 'device': await revokeAdminDevice(user.userId, action.device.deviceId, values.reason); break;
      }
      if (!data.currentActor()) throw new Error('Admin session changed');
      if (action.kind === 'status') data.updateStatus(values.status);
      trigger.current = title.current;
      setFeedback(copy('Đã thực hiện.', 'Action completed.'));
      void data.reload();
    } catch (error) {
      if (typeof error === 'object' && error && 'response' in error && (error.response as { status?: number })?.status === 403) {
        setDenied(true); setPending(null); setOpen(false); trigger.current = null; data.reset();
      }
      throw error;
    } finally { operation.current = false; }
  }
  return <section aria-label={copy('Quản lý người dùng', 'User management')} className="min-w-0 space-y-6">
    <h2 className="sr-only">{copy('Danh sách và hồ sơ người dùng', 'User directory and profiles')}</h2>
    {denied ? <div role="alert" className="space-y-3 text-sm leading-6"><p>{copy('Quyền đã thay đổi. Tải lại quyền người dùng để tiếp tục.', 'Permissions changed. Reload user access to continue.')}</p>
      <Button type="button" variant="outline" loading={recovering} onClick={() => void recoverAccess()}>{copy('Tải lại quyền người dùng', 'Reload user access')}</Button>
      {recoveryError ? <p>{copy('Chưa tải được quyền. Thử lại.', 'Could not reload access. Retry.')}</p> : null}</div> : !canRead ? <p className="text-sm text-muted-foreground">{copy('Bạn không có quyền xem người dùng.', 'You do not have access to users.')}</p>
      : <div className="admin-directory" data-detail={Boolean(data.selected)}>
        <div className="admin-directory-list">
          <form aria-label={copy('Tìm người dùng', 'Find a user')} onSubmit={event => { event.preventDefault(); guard(() => { data.select(null); void data.search(); }); }} className="flex items-center gap-2">
            <Input ref={search} value={data.query} onChange={event => data.setQuery(event.target.value)} aria-label={copy('Tìm người dùng quản trị', 'Search admin users')} placeholder={copy('Tên hoặc @tài khoản', 'Name or @username')} disabled={busy} />
            <Button type="submit" size="icon" variant="outline" loading={data.searchState === 'loading' && data.query.trim() === data.searchedQuery} disabled={busy || data.query.trim().length < 2} aria-label={copy('Tìm kiếm', 'Search')}><Search size={17} aria-hidden="true" /></Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">{copy('Nhập từ 2 ký tự · tối đa 20 kết quả.', 'Enter 2+ characters · up to 20 results.')}</p>
          <div aria-live="polite" className="admin-directory-results mt-3">
            {data.searchState === 'loading' ? <div role="status" aria-label={copy('Đang tìm người dùng', 'Searching users')} className="space-y-4 py-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
              : data.searchState === 'error' ? <div role="alert" className="space-y-3 py-6 text-sm"><p>{copy('Chưa tìm được người dùng. Thử lại.', 'Could not search users. Retry.')}</p><Button type="button" variant="outline" disabled={busy} onClick={() => void data.search()}>{copy('Thử lại', 'Retry')}</Button></div>
                : data.users.length ? data.users.map(candidate => <button type="button" key={candidate.userId} disabled={busy} aria-pressed={data.selected?.userId === candidate.userId} className="admin-room-entry" onClick={() => choose(candidate)}>
                  <AdminUserPortrait user={candidate} /><span className="min-w-0"><strong className="block truncate text-sm font-semibold">{candidate.displayName || candidate.userName}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">@{candidate.userName} · {userStatusLabel(candidate.status, locale)}</span></span><ChevronRight size={16} aria-hidden="true" />
                </button>) : <p className="py-8 text-sm text-muted-foreground">{data.searchState === 'idle' ? copy('Tìm một người để xem hồ sơ.', 'Find someone to inspect their profile.') : copy('Không có người dùng khớp tìm kiếm.', 'No matching users.')}</p>}
          </div>
        </div>
        <div className="admin-directory-detail">
          {data.selected ? <AdminUserDetail key={data.selected.userId} title={title} user={data.selected} overview={overview} resources={data.resources} busy={busy} onAction={edit} onBack={() => choose(null)}
            onRefresh={() => guard(() => { void data.inspect().catch(() => setFeedback(copy('Chưa tải được hồ sơ mới.', 'Could not load a fresh profile.'))); })}
            onSanctions={() => { const userId = data.selected?.userId; if (userId) guard(() => onSanctions(userId)); }} /> : <div className="admin-directory-placeholder"><AdminDirectoryArt kind="person" /><p className="text-sm text-muted-foreground">{copy('Chọn người dùng để xem.', 'Select a user to inspect.')}</p></div>}
        </div>
      </div>}
    {pending && !open ? <div className="flex flex-wrap items-center gap-2 text-sm"><span>{exit.uncertain ? copy('Thao tác chưa được xác nhận.', 'Action outcome is unconfirmed.') : copy('Có thay đổi chưa gửi.', 'An action draft is kept.')}</span><Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>{copy('Tiếp tục', 'Resume')}</Button><Button type="button" variant="ghost" size="sm" onClick={() => guard(() => { setPending(null); })}>{copy('Bỏ thao tác', 'Discard action')}</Button></div> : null}
    {feedback ? <p role="status" className="text-sm text-muted-foreground">{feedback}</p> : null}
    <details className="admin-room-disclosure"><summary><span className="flex items-center gap-2"><Shield size={16} aria-hidden="true" />{copy('Quyền của bạn', 'Your permissions')}</span><ChevronDown size={16} aria-hidden="true" /></summary><div className="flex flex-wrap gap-2 py-3">{[...overview.roles, ...overview.permissions].map(code => <Badge key={code} variant="outline">{code}</Badge>)}</div></details>
    {pending ? <AdminUserActionDialog key={pending.id} action={pending.action} user={pending.user} roles={pending.roles} permissions={overview.permissions} open={open} trigger={trigger}
      onState={updateExit} onClose={() => setOpen(false)} onDiscard={() => { setOpen(false); setPending(null); }} onCommit={commit} onInspect={data.inspect} /> : null}
    <ConfirmDialog open={confirmation} onOpenChange={value => { if (!value) navigation.current = null; setConfirmation(value); }}
      title={copy('Bỏ thao tác đang giữ?', 'Discard the kept action?')}
      description={exit.uncertain ? copy('Máy chủ có thể đã thực hiện. Bỏ thao tác không hủy yêu cầu và không gửi lại.', 'The server may have completed it. Discarding neither cancels nor resubmits the request.') : copy('Bản nháp này chưa được gửi và sẽ bị bỏ.', 'This unsent draft will be discarded.')}
      confirmLabel={copy('Bỏ thao tác', 'Discard action')} destructive onConfirm={() => { const next = navigation.current; navigation.current = null; setConfirmation(false); setPending(null); setOpen(false); next?.(); }} />
  </section>;
}
