import { useCallback, useEffect, useRef, useState } from 'react';
import { Sticker as StickerIcon, X } from 'lucide-react';
import { listStickerPacks, listStickers, type Sticker, type StickerPack } from '../api/stickers.api';
import { useStickerPage } from '../model/useStickerPage';
import { Button } from '@/shared/ui/Button';
import { localizeText, useAppLocale } from '@/shared/i18n';

const packId = (pack: StickerPack) => pack.stickerPackId;
const stickerId = (sticker: Sticker) => sticker.stickerId;

function StickerArtworkGrid({ pack, onSend, disabled }: { pack: StickerPack; onSend: (id: string) => Promise<void>; disabled: boolean }) {
  const fetchPage = useCallback((cursor?: string, signal?: AbortSignal) => listStickers(pack.stickerPackId, cursor, signal), [pack.stickerPackId]);
  const page = useStickerPage(fetchPage, stickerId);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const sendingRef = useRef(false);
  const send = async (id: string) => {
    if (sendingRef.current || disabled) return;
    sendingRef.current = true;
    setSending(true);
    setSendError(false);
    try { await onSend(id); } catch { setSendError(true); }
    finally { sendingRef.current = false; setSending(false); }
  };
  return <div aria-busy={page.loading || sending} className="space-y-3">
    <h3 className="text-sm font-semibold">{pack.name}</h3>
    {sendError ? <p role="alert" className="text-sm text-destructive">{localizeText('Chưa gửi được sticker. Bạn có thể thử lại từ tin nhắn bị lỗi.')}</p> : null}
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {page.items.map(item => <Button key={item.stickerId} type="button" variant="ghost" disabled={disabled || sending || !item.image}
        className="h-auto min-h-20 min-w-0 flex-col gap-1 p-2" onClick={() => void send(item.stickerId)} aria-label={item.name}>
        {item.image ? <img src={item.image.url} alt="" loading="lazy" width={item.image.width} height={item.image.height} className="h-16 w-full object-contain" /> : <StickerIcon className="h-12 w-12 text-muted-foreground" aria-hidden="true" />}
        <span className="w-full truncate text-xs">{item.name}</span>
      </Button>)}
      {page.loading ? Array.from({ length: 3 }, (_, index) => <div key={`loading-${index}`} className="h-24 rounded-md bg-muted" />) : null}
    </div>
    {page.loading ? <p role="status" className="text-sm text-muted-foreground">{localizeText('Đang tải sticker...')}</p> : null}
    {page.error ? <div role="alert" className="flex items-center justify-between gap-2 text-sm"><p>{localizeText('Không tải được sticker.')}</p><Button type="button" size="sm" variant="outline" onClick={page.retry}>{localizeText('Thử lại')}</Button></div> : null}
    {!page.loading && !page.error && !page.hasNext && page.items.length === 0 ? <p className="text-sm text-muted-foreground">{localizeText('Bộ này chưa có sticker để gửi. Hãy chọn bộ khác.')}</p> : null}
    {!page.loading && !page.error && page.hasNext && page.items.length === 0 ? <p role="status" className="text-sm text-muted-foreground">{localizeText('Trang này chưa có sticker. Chọn “Xem thêm sticker” để tìm tiếp.')}</p> : null}
    {page.hasNext && !page.error ? <Button type="button" size="sm" variant="outline" disabled={page.loading} onClick={page.loadMore}>{localizeText('Xem thêm sticker')}</Button> : null}
  </div>;
}

export function StickerPicker({ onClose, onSend, disabled }: { onClose: () => void; onSend: (id: string) => Promise<void>; disabled: boolean }) {
  const { locale } = useAppLocale();
  const packs = useStickerPage(listStickerPacks, packId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = packs.items.find(pack => pack.stickerPackId === selectedId) ?? packs.items[0];
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  return <section lang={locale} aria-label={localizeText('Chọn sticker')} className="mb-3 max-h-[60dvh] space-y-4 overflow-y-auto rounded-lg border border-border bg-card p-3 text-foreground sm:p-4"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">{localizeText('Chọn sticker')}</h2><Button ref={closeRef} type="button" variant="ghost" size="icon" onClick={onClose} aria-label={localizeText('Đóng')}><X size={18} aria-hidden="true" /></Button></div>
    <div aria-label={localizeText('Bộ sticker')} className="flex gap-2 overflow-x-auto pb-2">
      {packs.items.map(pack => <Button key={pack.stickerPackId} type="button" size="sm" variant={pack.stickerPackId === selected?.stickerPackId ? 'secondary' : 'ghost'}
        aria-pressed={pack.stickerPackId === selected?.stickerPackId} className="shrink-0" disabled={disabled} onClick={() => setSelectedId(pack.stickerPackId)}>{pack.name}</Button>)}
      {packs.hasNext && !packs.error ? <Button type="button" size="sm" variant="outline" disabled={packs.loading} onClick={packs.loadMore}>{localizeText('Xem thêm bộ')}</Button> : null}
    </div>
    {packs.loading ? <p role="status" className="text-sm text-muted-foreground">{localizeText('Đang tải bộ sticker...')}</p> : null}
    {packs.error ? <div role="alert" className="flex items-center justify-between gap-2 text-sm"><p>{localizeText('Không tải được bộ sticker.')}</p><Button type="button" size="sm" variant="outline" onClick={packs.retry}>{localizeText('Thử lại')}</Button></div> : null}
    {!packs.loading && !packs.error && !packs.hasNext && packs.items.length === 0 ? <p className="text-sm text-muted-foreground">{localizeText('Chưa có bộ sticker nào. Bạn vẫn có thể gửi tin nhắn hoặc emoji.')}</p> : null}
    {!packs.loading && !packs.error && packs.hasNext && packs.items.length === 0 ? <p role="status" className="text-sm text-muted-foreground">{localizeText('Trang này chưa có bộ sticker. Chọn “Xem thêm bộ” để tìm tiếp.')}</p> : null}
    {selected ? <StickerArtworkGrid key={selected.stickerPackId} pack={selected} onSend={onSend} disabled={disabled} /> : null}
  </section>;
}
