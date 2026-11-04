import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { ArrowLeft, ChevronDown, KeyRound, Monitor, RefreshCcw, Shield, Smartphone } from 'lucide-react';
import type { UserDTO } from '@/entities/user/model/user.types';
import { useAppLocale } from '@/shared/i18n';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/Avatar';
import { Badge, Button, Skeleton } from '@/shared/ui';
import type { AdminOverview } from '../api/admin.api';
import type { UserAction, UserResources } from '../model/useAdminUsers';
import { userRoleLabel, userStatusLabel } from '../model/useAdminUsers';

export function AdminUserPortrait({ user, large = false }: { user: UserDTO; large?: boolean }) {
  return <Avatar className={large ? 'h-20 w-20' : 'h-11 w-11'}>
    <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="object-cover" />
    <AvatarFallback>{Array.from(user.displayName || user.userName).slice(0, 2).join('').toLocaleUpperCase()}</AvatarFallback>
  </Avatar>;
}

export function AdminUserDetail({ user, resources, overview, busy, onAction, onBack, onRefresh, onSanctions, title }: {
  user: UserDTO; resources: UserResources; overview: AdminOverview; busy: boolean;
  onAction: (action: UserAction, trigger: HTMLButtonElement) => void;
  onBack: () => void; onRefresh: () => void; onSanctions: () => void;
  title: RefObject<HTMLHeadingElement | null>;
}) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [tab, setTab] = useState<'roles' | 'security'>('roles');
  useEffect(() => { title.current?.focus(); }, [user.userId, title]);
  const can = (permission: string) => overview.permissions.includes(permission);
  const assigned = new Set(resources.roles?.map(role => role.roleCode));
  const available = resources.roles !== null && overview.availableRoleCodes.some(code => !assigned.has(code));
  const formatDate = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US') : null;
  const resourceError = (text: string) => <div role="alert" className="space-y-3 py-4 text-sm"><p>{text}</p><Button type="button" variant="outline" onClick={onRefresh} disabled={busy}>{copy('Thử lại', 'Retry')}</Button></div>;
  return <section aria-label={copy('Hồ sơ quản trị người dùng', 'User administration profile')} className="min-w-0">
    <Button type="button" size="sm" variant="ghost" className="mb-4 min-h-11 lg:hidden" onClick={onBack} disabled={busy}><ArrowLeft size={16} aria-hidden="true" />{copy('Danh sách người dùng', 'User list')}</Button>
    <header className="flex items-start gap-4"><AdminUserPortrait user={user} large /><div className="min-w-0 flex-1">
      <h3 ref={title} tabIndex={-1} className="break-words text-xl font-semibold outline-none">{user.displayName || user.userName}</h3>
      <p className="mt-1 break-words text-sm text-muted-foreground">@{user.userName}</p>
      <Badge variant={user.status === 'ACTIVE' ? 'outline' : 'secondary'} className="mt-3">{userStatusLabel(user.status, locale)}</Badge>
    </div><Button type="button" size="icon" variant="ghost" onClick={onRefresh} disabled={busy || resources.loading} aria-label={copy('Tải lại hồ sơ', 'Refresh profile')}><RefreshCcw size={17} aria-hidden="true" /></Button></header>
    <div className="mt-5 flex flex-wrap gap-2">
      {user.userId !== overview.actorId && (can('USER_SUSPEND') || can('USER_RESTORE') && user.status !== 'ACTIVE') ? <Button type="button" variant="outline" size="sm" disabled={busy} onClick={event => onAction({ kind: 'status' }, event.currentTarget)}>{copy('Trạng thái tài khoản', 'Account status')}</Button> : null}
      {can('REPORT_MANAGE') ? <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onSanctions}>{copy('Chế tài', 'Sanctions')}</Button> : null}
    </div>
    <div role="group" aria-label={copy('Thông tin người dùng', 'User information')} className="admin-directory-filters mt-5">
      <button type="button" aria-pressed={tab === 'roles'} onClick={() => setTab('roles')}>{copy('Vai trò', 'Roles')}</button>
      <button type="button" aria-pressed={tab === 'security'} onClick={() => setTab('security')}>{copy('Đăng nhập', 'Sign-ins')}</button>
    </div>
    {resources.loading ? <div role="status" aria-label={copy('Đang tải hồ sơ', 'Loading profile')} className="space-y-4 py-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
      : tab === 'roles' ? <section aria-label={copy('Vai trò người dùng', 'User roles')}>
        {can('APP_ROLE_MANAGE') ? <Button type="button" size="sm" variant="outline" className="mb-3" disabled={busy || !available} onClick={event => onAction({ kind: 'grant' }, event.currentTarget)}><Shield size={16} aria-hidden="true" />{copy('Cấp vai trò', 'Grant role')}</Button> : null}
        {resources.roles === null ? resourceError(copy('Chưa tải được vai trò.', 'Could not load roles.')) : !resources.roles.length ? <p className="py-5 text-sm text-muted-foreground">{copy('Chưa có vai trò ứng dụng.', 'No application roles assigned.')}</p>
          : <ul>{resources.roles.map(role => <li key={role.grantId} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><Badge variant="outline" title={role.roleCode}>{userRoleLabel(role.roleCode, locale)}</Badge>
            {role.expiresAt ? <p className="mt-2 text-xs text-muted-foreground">{copy('Hết hạn', 'Expires')}: {formatDate(role.expiresAt) || copy('Không đọc được thời gian', 'Time unavailable')}</p> : null}</div>
            {can('APP_ROLE_MANAGE') ? <Button type="button" variant="ghost" size="sm" disabled={busy || role.roleCode === 'SUPER_ADMIN' && user.userId === overview.actorId}
              aria-label={`${copy('Thu hồi vai trò', 'Revoke role')}: ${role.roleCode}`} onClick={event => onAction({ kind: 'role', role }, event.currentTarget)}>{copy('Thu hồi', 'Revoke')}</Button> : null}</li>)}</ul>}
      </section> : <section aria-label={copy('Phiên và thiết bị', 'Sessions and devices')} className="space-y-5">
        <p className="text-xs text-muted-foreground">{copy('Tối đa 100 thiết bị và 100 phiên đã tải.', 'Up to 100 loaded devices and 100 sessions.')}</p>
        <div><h4 className="text-sm font-semibold">{copy('Thiết bị', 'Devices')}</h4>
          {resources.devices === null ? resourceError(copy('Chưa tải được thiết bị.', 'Could not load devices.')) : !resources.devices.length ? <p className="py-4 text-sm text-muted-foreground">{copy('Chưa có thiết bị.', 'No devices.')}</p>
            : <ul>{resources.devices.map(device => { const Icon = ['ANDROID', 'IOS'].includes(device.platform ?? '') ? Smartphone : device.platform === 'WEB' ? Monitor : KeyRound;
              return <li key={device.deviceId} className="flex items-start gap-3 py-4"><Icon size={27} className="mt-1 shrink-0 text-muted-foreground" aria-hidden="true" /><div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold">{device.deviceName || copy('Thiết bị chưa đặt tên', 'Unnamed device')}</p><p className="mt-1 text-xs text-muted-foreground">{device.platform || copy('Chưa rõ nền tảng', 'Platform unavailable')} · {device.active ? copy('Đang hoạt động', 'Active') : copy('Đã thu hồi', 'Revoked')}</p>
                {formatDate(device.lastSeenAt) ? <p className="mt-2 text-xs text-muted-foreground">{copy('Lần cuối', 'Last seen')}: {formatDate(device.lastSeenAt)}</p> : null}
                {device.active && can('SESSION_REVOKE') ? <Button type="button" variant="ghost" size="sm" className="mt-2" disabled={busy} aria-label={`${copy('Thu hồi thiết bị', 'Revoke device')}: ${device.deviceName || device.deviceId}`} onClick={event => onAction({ kind: 'device', device }, event.currentTarget)}>{copy('Thu hồi', 'Revoke')}</Button> : null}
              </div></li>; })}</ul>}
        </div>
        <div><h4 className="text-sm font-semibold">{copy('Phiên đăng nhập', 'Sign-in sessions')}</h4>
          {resources.sessions === null ? resourceError(copy('Chưa tải được phiên đăng nhập.', 'Could not load sign-in sessions.')) : !resources.sessions.length ? <p className="py-4 text-sm text-muted-foreground">{copy('Chưa có phiên đăng nhập.', 'No sign-in sessions.')}</p>
            : <ul>{resources.sessions.map(session => <li key={session.tokenId} className="py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm">{session.revokedAt ? copy('Đã thu hồi', 'Revoked') : copy('Chưa thu hồi', 'Not revoked')}</p>
              {formatDate(session.expiresAt) ? <p className="mt-1 text-xs text-muted-foreground">{copy('Hết hạn', 'Expires')}: {formatDate(session.expiresAt)}</p> : null}</div>
              {!session.revokedAt && can('SESSION_REVOKE') ? <Button type="button" variant="ghost" size="sm" disabled={busy} aria-label={`${copy('Thu hồi phiên đăng nhập', 'Revoke sign-in session')}: ${session.tokenId.slice(0, 12)}…`} onClick={event => onAction({ kind: 'session', session }, event.currentTarget)}>{copy('Thu hồi', 'Revoke')}</Button> : null}</div>
              <details className="admin-room-disclosure mt-2"><summary className="text-xs">{copy('Thông tin phiên', 'Session details')}<ChevronDown size={14} aria-hidden="true" /></summary><p className="break-all py-2 text-xs text-muted-foreground">{session.tokenId}</p>{session.deviceId ? <p className="break-all text-xs text-muted-foreground">{session.deviceId}</p> : null}</details>
            </li>)}</ul>}
        </div>
      </section>}
    <details className="admin-room-disclosure mt-6"><summary>{copy('Thông tin tài khoản', 'Account details')}<ChevronDown size={16} aria-hidden="true" /></summary><p className="break-all py-3 text-xs text-muted-foreground">{user.userId}</p></details>
  </section>;
}
