import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useGiphySearch } from '../model/useGiphySearch';
import { giphyWebKey } from '../api/giphy.client';
import { GiphyAttribution } from './GiphyAttribution';
import { GifSearchResult } from './GifSearchResult';
import type { GifReference } from '@/features/messenger/types/messenger.types';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { localizeText, useAppLocale } from '@/shared/i18n';

export function GifPicker({ onClose, onSend, disabled }: { onClose: () => void; onSend: (gif: GifReference) => Promise<void>; disabled: boolean }) {
  const { locale } = useAppLocale();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [animate, setAnimate] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const sendingRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const page = useGiphySearch(debouncedQuery, locale);
  const pending = query !== debouncedQuery;
  useEffect(() => { (searchRef.current ?? closeRef.current)?.focus(); }, []);
  useEffect(() => { const timer = setTimeout(() => setDebouncedQuery(query), 300); return () => clearTimeout(timer); }, [query]);
  const send = async (providerGifId: string) => {
    if (sendingRef.current || disabled || pending) return;
    sendingRef.current = true; setSending(true); setSendError(false);
    try { await onSend({ provider: 'GIPHY', providerGifId }); } catch { setSendError(true); }
    finally { sendingRef.current = false; setSending(false); }
  };
  const errorCopy = page.error === 'UNCONFIGURED' ? 'Chưa cấu hình GIF cho ứng dụng.' : page.error === 'RATE_LIMITED'
    ? 'GIPHY đang giới hạn lượt tải. Bạn thử lại sau nhé.' : 'Không tải được GIF.';
  return <section lang={locale} aria-label={localizeText('Chọn GIF')} className="mb-3 max-h-[60dvh] space-y-3 overflow-y-auto rounded-lg border border-border bg-card p-3 text-foreground sm:p-4"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">{localizeText('Chọn GIF')}</h2>
      <Button ref={closeRef} type="button" size="icon" variant="ghost" aria-label={localizeText('Đóng')} onClick={onClose}><X size={18} aria-hidden="true" /></Button></div>
    {giphyWebKey ? <>
      <Input ref={searchRef} type="search" aria-label={localizeText('Tìm GIF')} placeholder={localizeText('Tìm GIF')} maxLength={50} value={query} disabled={disabled || sending} onChange={event => setQuery(event.target.value)} />
      <p className="text-xs text-muted-foreground">{localizeText('Từ khóa tìm kiếm được gửi tới GIPHY.')}</p>
      <Button type="button" size="sm" variant="outline" aria-pressed={animate} onClick={() => setAnimate(value => !value)}>{localizeText(animate ? 'Dừng ảnh xem trước' : 'Phát ảnh xem trước')}</Button>
      {sendError ? <p role="alert" className="text-sm text-destructive">{localizeText('Chưa gửi được GIF. Bạn có thể thử lại từ tin nhắn bị lỗi.')}</p> : null}
      {!pending ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-busy={page.loading || sending}>
        {page.items.map((gif, index) => <GifSearchResult key={`${debouncedQuery}:${gif.id}:${index}`} gif={gif} animate={animate} disabled={disabled || sending} onSend={() => void send(gif.id)} />)}
      </div> : null}
      {pending || page.loading ? <p role="status" className="text-sm text-muted-foreground">{localizeText('Đang tải GIF…')}</p> : null}
      {!pending && page.error ? <div role="alert" className="space-y-2 text-sm"><p>{localizeText(errorCopy)}</p>
        {page.error !== 'UNCONFIGURED' ? <Button type="button" size="sm" variant="outline" onClick={page.retry}>{localizeText('Thử lại')}</Button> : null}</div> : null}
      {!pending && !page.loading && !page.error && page.items.length === 0 ? <p className="text-sm text-muted-foreground">{localizeText('Chưa tìm thấy GIF. Bạn thử từ khóa khác nhé.')}</p> : null}
      {!pending && !page.error && page.nextOffset !== null ? <Button type="button" size="sm" variant="outline" disabled={page.loading || sending} onClick={page.loadMore}>{localizeText('Xem thêm GIF')}</Button> : null}
      <GiphyAttribution />
    </> : <p className="text-sm text-muted-foreground">{localizeText('Chưa cấu hình GIF cho ứng dụng.')}</p>}
  </section>;
}
