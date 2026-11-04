import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { File, ImageIcon, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { getSharedContent, getSharedSource, safeSharedUrl, type SharedContentItem, type SharedContentKind } from '@/features/messenger/api/shared-content.api';
import type { BackendMessage } from '@/features/messenger/api/messenger.api';

const kinds = [
  { id: 'IMAGES', label: 'Ảnh', icon: ImageIcon },
  { id: 'FILES', label: 'Tệp', icon: File },
  { id: 'LINKS', label: 'Liên kết', icon: LinkIcon },
] as const;

export function SharedContentDialog({ conversationId, open, onOpenChange }: {
  conversationId: string; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const { locale } = useAppLocale();
  const [kind, setKind] = useState<SharedContentKind>('IMAGES');
  const [items, setItems] = useState<SharedContentItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [source, setSource] = useState<BackendMessage | null>(null);
  const [sourceItem, setSourceItem] = useState<SharedContentItem | null>(null);
  const sourceMode = sourceItem !== null;
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const seenCursors = useRef(new Set<string>());

  const load = async (after: string | null, append: boolean, signal: AbortSignal) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(false);
    try {
      // Scan a bounded set of empty filtered pages; retain a manual continuation path.
      const visited = new Set(seenCursors.current);
      if (after !== null) {
        if (visited.has(after)) throw new Error('Repeated archive cursor');
        visited.add(after);
      }
      let page = await getSharedContent(conversationId, kind, after, signal);
      for (let scan = 0; !signal.aborted && page.hasNext; scan++) {
        if (!page.nextCursor || visited.has(page.nextCursor)) throw new Error('Repeated archive cursor');
        if (page.content.length > 0 || scan >= 4) break;
        visited.add(page.nextCursor);
        page = await getSharedContent(conversationId, kind, page.nextCursor, signal);
      }
      if (signal.aborted) return;
      seenCursors.current = visited;
      setItems(previous => [...new Map([...(append ? previous : []), ...page.content].map(item => [item.id, item])).values()]);
      setCursor(page.nextCursor);
      setHasNext(page.hasNext);
    } catch (failure) {
      if (!signal.aborted) {
        const transportFailure = isAxiosError(failure);
        const status = transportFailure ? failure.response?.status : undefined;
        const retryContinuation = append && transportFailure
          && (status === undefined || status === 408 || status === 429 || status >= 500);
        if (!retryContinuation) {
          setItems([]);
          setCursor(null);
          setHasNext(false);
        }
        setError(true);
      }
    } finally {
      if (!signal.aborted) { setLoading(false); busy.current = false; }
    }
  };

  useEffect(() => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    busy.current = false;
    seenCursors.current.clear();
    setItems([]); setCursor(null); setHasNext(false); setSource(null); setSourceItem(null);
    if (open) void load(null, false, controller.signal);
    return () => controller.abort();
    // The scope changes on room, tab, reopen and explicit retry; pagination calls load separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, kind, open, retry]);

  const openSource = async (item: SharedContentItem) => {
    const controller = request.current;
    if (busy.current || !controller) return;
    busy.current = true;
    setSourceItem(item); setSource(null); setLoading(true); setError(false);
    try {
      const message = await getSharedSource(conversationId, item, controller.signal);
      if (!controller.signal.aborted) setSource(message);
    } catch { if (!controller.signal.aborted) { setItems([]); setError(true); } }
    finally { if (!controller.signal.aborted) { setLoading(false); busy.current = false; } }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{localizeText(sourceMode ? 'Tin nhắn gốc' : 'Tệp và nội dung dùng chung')}</DialogTitle>
        <DialogDescription>{localizeText('Nội dung trong cuộc trò chuyện này.')}</DialogDescription>
      </DialogHeader>
      {sourceMode ? <Button variant="outline" onClick={() => {
        setSourceItem(null); setSource(null); setError(false);
        if (items.length === 0) setRetry(value => value + 1);
      }} disabled={loading}>{localizeText('Về thư viện')}</Button> :
        <div className="flex gap-2" role="group" aria-label={localizeText('Loại nội dung')}>
          {kinds.map(({ id, label, icon: Icon }) => <Button key={id} variant={id === kind ? 'default' : 'outline'} aria-pressed={kind === id} onClick={() => setKind(id)}><Icon size={16} />{localizeText(label)}</Button>)}
        </div>}
      <div className="min-h-36 space-y-4 overflow-y-auto" aria-busy={loading}>
        {sourceMode && source ? <article className="space-y-3 rounded-lg bg-muted p-4">
          <time className="text-xs text-muted-foreground">{new Date(source.createdAt).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')}</time>
          <p className="whitespace-pre-wrap break-words">{source.isDeleted ? localizeText('Tin nhắn đã bị xóa') : source.content || localizeText('Tin nhắn có tệp đính kèm')}</p>
        </article> : null}
        {!sourceMode && items.map(item => {
          const url = safeSharedUrl(item.url);
          return <article key={item.id} className="flex gap-3 rounded-lg border border-border p-3">
            {kind === 'IMAGES' && url && !item.spoiler ?
              <img src={url} alt={item.name} loading="lazy" referrerPolicy="no-referrer" className="h-20 w-20 shrink-0 rounded object-cover" /> : <File className="mt-1 shrink-0 text-muted-foreground" />}
            <div className="min-w-0 flex-1 space-y-1">
              {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="block break-all font-medium underline decoration-border underline-offset-4 hover:text-primary">{item.name || url}</a> : <p>{item.name}</p>}
              {item.byteSize !== null ? <p className="text-xs text-muted-foreground">{new Intl.NumberFormat(locale).format(item.byteSize)} B</p> : null}
              <time className="block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN')}</time>
              <Button variant="ghost" size="sm" onClick={() => void openSource(item)} disabled={loading}>{localizeText('Xem tin nhắn gốc')}</Button>
            </div>
          </article>;
        })}
        {loading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />{localizeText('Đang tải…')}</p> : null}
        {error ? <div role="alert" className="space-y-2"><p>{localizeText('Không thể tải nội dung. Hãy thử lại.')}</p><Button onClick={() => {
          if (sourceItem) void openSource(sourceItem);
          else if (cursor && request.current) void load(cursor, true, request.current.signal);
          else setRetry(value => value + 1);
        }}>{localizeText('Thử lại')}</Button></div> : null}
        {!sourceMode && !loading && !error && !items.length ? <p className="py-6 text-sm text-muted-foreground">{localizeText(hasNext ? 'Chưa tìm thấy trong phần lịch sử vừa đọc. Bạn có thể xem tiếp.' : 'Chưa có nội dung loại này. Ảnh, tệp hoặc liên kết bạn gửi sẽ xuất hiện ở đây.')}</p> : null}
        {!sourceMode && hasNext && !error ? <Button variant="outline" disabled={loading} onClick={() => { if (request.current) void load(cursor, true, request.current.signal); }}>{localizeText('Xem thêm')}</Button> : null}
      </div>
    </DialogContent>
  </Dialog>;
}
