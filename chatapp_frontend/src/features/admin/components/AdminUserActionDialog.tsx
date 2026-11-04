import { useEffect, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';
import axios from 'axios';
import type { UserDTO } from '@/entities/user/model/user.types';
import { useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { ModalShell } from '@/shared/ui/ModalShell';
import type { UserAction, UserExitState } from '../model/useAdminUsers';
import { userRoleLabel, userStatusLabel } from '../model/useAdminUsers';

export interface UserActionValues { reason: string; role: string; status: 'ACTIVE' | 'SUSPENDED' | 'BANNED'; expiresAt?: string }
export function AdminUserActionDialog({ action, user, roles, permissions, open, trigger, onClose, onDiscard, onState, onCommit, onInspect }: {
  action: UserAction; user: UserDTO; roles: string[]; permissions: string[]; open: boolean;
  trigger: RefObject<HTMLElement | null>; onClose: () => void; onDiscard: () => void;
  onState: (state: UserExitState) => void; onCommit: (values: UserActionValues) => Promise<void>; onInspect: () => Promise<void>;
}) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const titles = { grant: copy('Cấp vai trò', 'Grant role'), status: copy('Đổi trạng thái tài khoản', 'Change account status'),
    role: copy('Thu hồi vai trò', 'Revoke role'), session: copy('Thu hồi phiên đăng nhập', 'Revoke sign-in session'), device: copy('Thu hồi thiết bị', 'Revoke device') };
  const title = titles[action.kind];
  const [reason, setReason] = useState(''), [role, setRole] = useState(''), [expiry, setExpiry] = useState('');
  const [status, setStatus] = useState(user.status);
  const [phase, setPhase] = useState<'editing' | 'saving' | 'uncertain' | 'inspecting'>('editing');
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false), mounted = useRef(false), id = useId();
  const dirty = Boolean(reason || role || expiry || status !== user.status);
  const busy = phase === 'saving' || phase === 'inspecting', uncertain = phase === 'uncertain';
  const locked = busy || uncertain;
  const date = expiry ? new Date(expiry) : null;
  const expiryValid = !date || Number.isFinite(date.getTime()) && date.getTime() > Date.now();
  const statusAllowed = ['ACTIVE', 'SUSPENDED', 'BANNED'].includes(status) && status !== user.status
    && permissions.includes(status === 'ACTIVE' ? 'USER_RESTORE' : 'USER_SUSPEND');
  const valid = reason.trim().length > 0 && reason.length <= 500 && !locked
    && (action.kind !== 'grant' || roles.includes(role) && expiryValid)
    && (action.kind !== 'status' || statusAllowed);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    onState({ draft: dirty || uncertain, busy, uncertain });
    return () => onState({ draft: false, busy: false, uncertain: false });
  }, [dirty, busy, uncertain, onState]);
  useEffect(() => {
    if (!dirty && !locked) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, locked]);
  async function submit() {
    if (inFlight.current) return;
    if (date && date.getTime() <= Date.now()) { setMessage(copy('Chọn thời điểm trong tương lai.', 'Choose a future time.')); return; }
    if (!valid) return;
    inFlight.current = true; setPhase('saving'); setMessage(null);
    try {
      await onCommit({ reason: reason.trim(), role, status: status as UserActionValues['status'], expiresAt: date?.toISOString() });
      if (mounted.current) onDiscard();
    } catch (error) {
      if (!mounted.current) return;
      const code = axios.isAxiosError(error) ? error.response?.status : undefined;
      setPhase(code === 400 || code === 422 || code === 403 ? 'editing' : 'uncertain');
      setMessage(code === 403 ? copy('Bạn không còn quyền thực hiện thao tác này.', 'You no longer have permission for this action.')
        : code === 400 || code === 422 ? copy('Kiểm tra giá trị và lý do rồi thử lại.', 'Check the value and reason before retrying.')
          : copy('Chưa xác nhận được kết quả. Không gửi lại; tải dữ liệu để kiểm tra.', 'Result not confirmed. Do not resubmit; load data to inspect.'));
    } finally { inFlight.current = false; }
  }
  return <ModalShell open={open} onClose={() => { if (!busy) { if (dirty || uncertain) onClose(); else onDiscard(); } }}
    title={title} description={`${title} · @${user.userName}`} returnFocusRef={trigger} closeDisabled={busy} showClose={!busy}
    className="inset-auto left-1/2 top-1/2 h-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border p-6 sm:max-w-md">
    <form aria-label={title} className="space-y-5" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <header className="pr-8"><h3 className="text-lg font-semibold">{title}</h3><p className="mt-1 break-words text-sm text-muted-foreground">@{user.userName}</p></header>
      {action.kind === 'role' ? <p className="break-words text-sm">{userRoleLabel(action.role.roleCode, locale)}</p> : null}
      {action.kind === 'device' ? <p className="break-words text-sm">{action.device.deviceName || copy('Thiết bị đã chọn', 'Selected device')}</p> : null}
      {action.kind === 'device' ? <p className="text-sm text-muted-foreground">{copy('Các phiên liên quan cũng sẽ bị thu hồi.', 'Related sessions will also be revoked.')}</p> : null}
      <fieldset disabled={locked} className="space-y-4">
        {action.kind === 'grant' ? <><div><label className="text-sm" htmlFor={`${id}-role`}>{copy('Vai trò', 'Role')}</label><Select id={`${id}-role`} className="mt-2" value={role} onChange={event => setRole(event.target.value)} required>
          <option value="">{copy('Chọn vai trò', 'Choose a role')}</option>{roles.map(code => <option key={code} value={code}>{userRoleLabel(code, locale)}</option>)}</Select></div>
          <div><label className="text-sm" htmlFor={`${id}-expiry`}>{copy('Hết hạn (tuỳ chọn)', 'Expires (optional)')}</label><Input id={`${id}-expiry`} className="mt-2" type="datetime-local" value={expiry} aria-invalid={!expiryValid || undefined} onChange={event => setExpiry(event.target.value)} />
            {!expiryValid ? <p role="alert" className="mt-2 text-xs text-destructive">{copy('Chọn thời điểm trong tương lai.', 'Choose a future time.')}</p> : null}</div></> : null}
        {action.kind === 'status' ? <div><label className="text-sm" htmlFor={`${id}-status`}>{copy('Trạng thái tài khoản', 'Account status')}</label><Select id={`${id}-status`} className="mt-2" value={status} onChange={event => setStatus(event.target.value)}>
          <option value={user.status} disabled>{copy('Hiện tại', 'Current')}: {userStatusLabel(user.status, locale)}</option>
          {(['ACTIVE', 'SUSPENDED', 'BANNED'] as const).filter(value => value !== user.status && permissions.includes(value === 'ACTIVE' ? 'USER_RESTORE' : 'USER_SUSPEND')).map(value => <option key={value} value={value}>{value === 'ACTIVE' ? copy('Đang hoạt động', 'Active') : value === 'SUSPENDED' ? copy('Tạm khóa', 'Suspended') : copy('Bị cấm', 'Banned')}</option>)}</Select></div> : null}
        <div><label className="text-sm" htmlFor={`${id}-reason`}>{copy('Lý do (bắt buộc)', 'Reason (required)')}</label><Input id={`${id}-reason`} className="mt-2" value={reason} maxLength={500} required onChange={event => setReason(event.target.value)} /></div>
      </fieldset>
      {message ? <p role="alert" className="text-sm leading-6 text-destructive">{message}</p> : null}
      {uncertain || phase === 'inspecting' ? <Button type="button" variant="outline" loading={phase === 'inspecting'} onClick={() => {
        setPhase('inspecting'); void onInspect().catch(() => {
          if (mounted.current) setMessage(copy('Chưa tải được dữ liệu mới. Kết quả vẫn chưa xác nhận.', 'Could not load fresh data. The outcome is still unconfirmed.'));
        }).finally(() => { if (mounted.current) setPhase('uncertain'); });
      }}>{copy('Tải dữ liệu để kiểm tra', 'Load data to inspect')}</Button> : null}
      <footer className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" disabled={busy} onClick={() => { if (uncertain) onClose(); else onDiscard(); }}>{uncertain ? copy('Đóng', 'Close') : copy('Hủy', 'Cancel')}</Button>
        {!uncertain ? <Button type="submit" variant={action.kind === 'grant' || action.kind === 'status' && status === 'ACTIVE' ? 'default' : 'destructive'} disabled={!valid} loading={phase === 'saving'}>{action.kind === 'grant' ? title : copy('Xác nhận', 'Confirm')}</Button> : null}
      </footer>
    </form>
  </ModalShell>;
}
