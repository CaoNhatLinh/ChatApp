import { useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, ChevronDown, ChevronRight, MessageCircle, Search, UsersRound } from 'lucide-react';
import type { AdminConversationSummary } from '../api/admin.api';
import { filterAdminRooms } from '../model/room-directory';
import { AdminRoomPortrait } from './AdminRoomPortrait';
import { AdminRoomImage } from './AdminRoomImage';
import { AdminDirectoryArt } from './AdminDirectoryArt';
import type { RoomFilter } from '../model/room-directory';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { Badge, Button, Input, Select, Skeleton } from '@/shared/ui';

interface AdminRoomDirectoryProps {
  rooms: AdminConversationSummary[];
  month: string;
  loading: boolean;
  directoryError: string | null;
  onReload: () => void;
  openingRoomId: string | null;
  readError: string | null;
  selectedRoom: AdminConversationSummary | null;
  canModerate: boolean;
  busy: boolean;
  policy: string;
  slowMode: number;
  reason: string;
  onMonth: (value: string) => void;
  onSelect: (room: AdminConversationSummary) => void;
  onBack: () => Promise<boolean>;
  onPolicy: (value: string) => void;
  onSlowMode: (value: number) => void;
  onReason: (value: string) => void;
  onSave: () => void;
  onArchive: () => void;
}

export function AdminRoomDirectory(props: AdminRoomDirectoryProps) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RoomFilter>('all');
  const search = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const { selectedRoom: room, busy } = props;
  const selectedId = room?.conversationId;
  useEffect(() => { if (selectedId) title.current?.focus(); }, [selectedId]);
  const visible = filterAdminRooms(props.rooms, query, filter);
  const formatDate = (value: string) => new Date(value).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US');
  return <section aria-label={copy('Quản lý toàn bộ phòng', 'Manage all rooms')} className="admin-directory" data-detail={Boolean(room || props.openingRoomId)}>
    <h2 className="sr-only">{copy('Quản lý toàn bộ phòng', 'Manage all rooms')}</h2>
    <div className="admin-directory-list">
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="admin-room-month" className="mb-2 block text-xs text-muted-foreground">{localizeText('Tháng tạo phòng (UTC)')}</label>
          <Input id="admin-room-month" type="month" value={props.month} disabled={busy} onChange={event => props.onMonth(event.target.value)} />
        </div>
      </div>
      <div className="relative mt-4">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground" />
        <Input ref={search} type="search" className="pl-9" aria-label={copy('Tìm trong tháng này', 'Search this month')} placeholder={copy('Tìm trong tháng này', 'Search this month')} value={query} onChange={event => setQuery(event.target.value)} />
      </div>
      <div role="group" aria-label={copy('Lọc trạng thái phòng', 'Filter room status')} className="admin-directory-filters">
        {(['all', 'active', 'archived'] as const).map(value => <button key={value} type="button" aria-pressed={filter === value}
          onClick={() => setFilter(value)}>{value === 'all' ? copy('Tất cả', 'All') : value === 'active' ? copy('Đang mở', 'Active') : copy('Lưu trữ', 'Archived')}</button>)}
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{copy('Tìm trong tối đa 100 phòng đã tải.', 'Search up to 100 loaded rooms.')}</p>
      {props.readError ? <p role="alert" className="my-3 text-sm text-destructive">{props.readError}</p> : null}
      <div aria-live="polite" aria-busy={props.loading} className="admin-directory-results">
        {props.directoryError ? <div role="alert" className="space-y-3 py-6 text-sm"><p>{props.directoryError}</p><Button type="button" variant="outline" onClick={props.onReload}>{copy('Thử lại', 'Retry')}</Button></div>
          : props.loading ? <div role="status" aria-label={copy('Đang tải phòng', 'Loading rooms')} className="space-y-4 py-4">{[0, 1, 2].map(index => <Skeleton key={index} className="h-16 w-full" />)}</div>
          : visible.length ? visible.map(item => <button key={item.conversationId} type="button" className="admin-room-entry" disabled={busy}
            aria-pressed={room?.conversationId === item.conversationId} onClick={() => props.onSelect(item)}>
            <AdminRoomPortrait room={item} />
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.name || item.conversationId}</span>
              <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><UsersRound size={12} aria-hidden="true" />{item.memberCount} {copy('thành viên', item.memberCount === 1 ? 'member' : 'members')}{item.deleted ? ` · ${copy('Đã lưu trữ', 'Archived')}` : ''}</span>
            </span>
            <ChevronRight size={16} aria-hidden="true" className="text-muted-foreground" />
          </button>) : <div className="admin-directory-empty" role="status">
            <Search size={28} aria-hidden="true" />
            <p>{query || filter !== 'all' ? copy('Không có phòng khớp bộ lọc.', 'No rooms match these filters.') : copy('Chưa có phòng trong tháng này.', 'No rooms in this month.')}</p>
            {query || filter !== 'all' ? <Button type="button" variant="ghost" onClick={() => { setQuery(''); setFilter('all'); }}>{copy('Xóa bộ lọc', 'Clear filters')}</Button> : null}
          </div>}
      </div>
    </div>
    <div className="admin-directory-detail">
      {room || props.openingRoomId ? <Button type="button" variant="ghost" size="sm" disabled={busy} className="mb-4 min-h-11 lg:hidden" onClick={() => {
        void props.onBack().then(cleared => { if (cleared) requestAnimationFrame(() => search.current?.focus()); });
      }}><ArrowLeft size={16} aria-hidden="true" />{copy('Danh sách phòng', 'Room list')}</Button> : null}
      {props.openingRoomId ? <div role="status" aria-label={copy('Đang mở phòng', 'Opening room')} className="space-y-4"><Skeleton className="h-16 w-16" /><Skeleton className="h-6 w-3/4" /><Skeleton className="h-24 w-full" /></div>
        : room ? <div key={room.conversationId}>
          <div className="flex items-start gap-4"><AdminRoomImage room={room} /><div className="min-w-0 py-1">
            <h3 ref={title} tabIndex={-1} className="break-words text-xl font-semibold outline-none">{room.name || copy('Phòng chưa đặt tên', 'Untitled room')}</h3>
            <Badge className="mt-2" variant={room.deleted ? 'secondary' : 'outline'}>{room.deleted ? localizeText('Đã lưu trữ') : localizeText('Đang hoạt động')}</Badge>
          </div></div>
          {room.description ? <p className="mt-5 break-words text-sm leading-6 text-muted-foreground">{room.description}</p> : null}
          <dl className="admin-room-facts">
            <div><dt><UsersRound size={16} aria-hidden="true" />{localizeText('Thành viên')}</dt><dd>{room.memberCount}</dd></div>
            <div><dt><MessageCircle size={16} aria-hidden="true" />{copy('Trò chuyện', 'Messaging')}</dt><dd>{localizeText(room.chatMode === 'OPEN' ? 'Mở' : room.chatMode === 'READ_ONLY' ? 'Chỉ đọc' : 'Chỉ quản lý')}</dd></div>
          </dl>
          <details className="admin-room-disclosure">
            <summary>{copy('Thông tin phòng', 'Room information')}<ChevronDown size={16} aria-hidden="true" /></summary>
            <dl className="mt-3 space-y-3 break-all text-sm"><div><dt className="text-xs text-muted-foreground">ID</dt><dd>{room.conversationId}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{localizeText('Chủ phòng')}</dt><dd>{room.ownerId || localizeText('Chưa có chủ phòng')}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{localizeText('Ngày tạo')}</dt><dd>{formatDate(room.createdAt)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{copy('ID thành viên đã tải', 'Loaded member IDs')}</dt><dd className="mt-2 max-h-32 space-y-2 overflow-auto text-xs">{room.members.map(member => <div key={member.userId}>{member.userId}</div>)}</dd></div>
            </dl>
          </details>
          {props.canModerate ? <details className="admin-room-disclosure">
            <summary>{copy('Điều chỉnh phòng', 'Manage room')}<ChevronDown size={16} aria-hidden="true" /></summary>
            <fieldset disabled={busy} className="mt-4 space-y-4">
              <div><label htmlFor="admin-room-policy" className="mb-2 block text-sm">{localizeText('Chính sách trò chuyện toàn cục')}</label>
                <Select id="admin-room-policy" value={props.policy} onChange={event => props.onPolicy(event.target.value)}><option value="OPEN">{localizeText('Mở')}</option><option value="READ_ONLY">{localizeText('Chỉ đọc')}</option><option value="MANAGERS_ONLY">{localizeText('Chỉ quản lý')}</option></Select></div>
              <div><label htmlFor="admin-room-slow-mode" className="mb-2 block text-sm">{localizeText('Chế độ chậm (giây)')}</label><Input id="admin-room-slow-mode" type="number" min={0} max={86400} value={props.slowMode} onChange={event => props.onSlowMode(Number(event.target.value))} /></div>
              <div><label htmlFor="admin-room-reason" className="mb-2 block text-sm">{localizeText('Lý do kiểm toán')}</label><Input id="admin-room-reason" value={props.reason} maxLength={500} onChange={event => props.onReason(event.target.value)} /></div>
              <div className="flex flex-wrap gap-2"><Button type="button" onClick={props.onSave} loading={busy} disabled={!props.reason.trim() || !Number.isInteger(props.slowMode) || props.slowMode < 0 || props.slowMode > 86400}>{localizeText('Lưu chính sách')}</Button>
                <Button type="button" variant={room.deleted ? 'outline' : 'destructive'} onClick={props.onArchive} disabled={busy || !props.reason.trim()}><Archive size={15} aria-hidden="true" />{room.deleted ? localizeText('Khôi phục') : localizeText('Lưu trữ phòng')}</Button></div>
            </fieldset>
          </details> : null}
        </div> : <div className="admin-directory-placeholder">
          <AdminDirectoryArt kind="room" />
          <p className="font-medium">{copy('Chọn một phòng', 'Choose a room')}</p>
        </div>}
    </div>
  </section>;
}
