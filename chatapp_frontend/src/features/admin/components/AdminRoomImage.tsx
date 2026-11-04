import { useRef, useState } from 'react';
import { ImageOff, Maximize2, RefreshCcw } from 'lucide-react';
import type { AdminConversationSummary } from '../api/admin.api';
import { AdminRoomPortrait } from './AdminRoomPortrait';
import { useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { ModalShell } from '@/shared/ui/ModalShell';
import { Skeleton } from '@/shared/ui/Skeleton';

function FullRoomImage({ url }: { url: string }) {
  const { locale } = useAppLocale();
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  return <div className="admin-room-image-frame" aria-busy={state === 'loading'}>
    {state === 'loading' ? <div role="status" aria-label={copy('Đang tải ảnh', 'Loading image')} className="absolute inset-0"><Skeleton className="h-full w-full" /></div> : null}
    {state === 'error' ? <div role="alert" className="flex flex-col items-center gap-3 p-5 text-center text-sm">
      <ImageOff size={32} aria-hidden="true" /><p>{copy('Không tải được ảnh.', 'Could not load the image.')}</p>
      <Button type="button" variant="outline" onClick={() => { setState('loading'); setVersion(value => value + 1); }}><RefreshCcw size={15} aria-hidden="true" />{copy('Thử lại', 'Retry')}</Button>
    </div> : <img key={version} src={url} alt={copy('Ảnh đại diện phòng', 'Room identity image')} referrerPolicy="no-referrer"
      className="h-full w-full object-contain" style={{ visibility: state === 'ready' ? 'visible' : 'hidden' }}
      onLoad={() => setState('ready')} onError={() => setState('error')} />}
  </div>;
}

export function AdminRoomImage({ room }: { room: AdminConversationSummary }) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const url = room.avatarUrl?.trim();
  if (!url) return <AdminRoomPortrait room={room} large />;
  return <>
    <button ref={trigger} type="button" className="admin-room-image-trigger" aria-haspopup="dialog" aria-label={copy('Xem ảnh phòng', 'View room image')} onClick={() => setOpen(true)}>
      <AdminRoomPortrait room={room} large /><span><Maximize2 size={12} aria-hidden="true" />{copy('Xem ảnh', 'View image')}</span>
    </button>
    <ModalShell open={open} onClose={() => setOpen(false)} title={copy('Ảnh phòng', 'Room image')} description={room.name || copy('Ảnh đại diện phòng', 'Room identity image')}
      returnFocusRef={trigger} className="admin-room-image-dialog block overflow-y-auto p-4">
      <p className="break-words pr-12 text-base font-semibold">{room.name || copy('Ảnh phòng', 'Room image')}</p>
      <FullRoomImage key={url} url={url} />
    </ModalShell>
  </>;
}
