import { useLayoutEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArrowLeft, ChevronRight, RefreshCw, X } from 'lucide-react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { getSessionGeneration } from '@/shared/auth/access-token';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useCallHistory } from '../hooks/useCallHistory';
import { CallHistoryFacts, CallHistorySummary } from './CallHistoryFacts';

interface HistoryProps { conversationId?: string; onClose: () => void }

export function CallHistoryDialog(props: HistoryProps) {
  const { actorId, enabled } = useAuthStore(useShallow(state => ({ actorId: state.user?.userId,
    enabled: Boolean(state.token) && !state.loading && !state.initializationError })));
  const generation = getSessionGeneration();
  if (!actorId || !enabled) return null;
  return <HistoryPanel key={`${actorId}/${generation}/${props.conversationId ?? 'own'}`} {...props} actorId={actorId} generation={generation} />;
}

function HistoryPanel({ actorId, generation, conversationId, onClose }: HistoryProps & { actorId: string; generation: number }) {
  useAppLocale();
  const maxMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(maxMonth);
  const history = useCallHistory({ actorId, conversationId, month }, generation);
  const inDetail = history.selected !== null;
  const title = useRef<HTMLHeadingElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const returnPoint = useRef<{ entryKey: string; scrollTop: number } | null>(null);
  const previousView = useRef(inDetail);
  useLayoutEffect(() => {
    if (previousView.current === inDetail) return;
    previousView.current = inDetail;
    const area = scrollArea.current;
    const target = returnPoint.current;
    if (inDetail) {
      if (area) area.scrollTop = 0;
      title.current?.focus({ preventScroll: true });
    } else if (area && target) {
      returnPoint.current = null;
      area.scrollTop = target.scrollTop;
      const button = area.querySelector<HTMLButtonElement>(`[data-call-history-entry="${CSS.escape(target.entryKey)}"]`);
      (button ?? title.current)?.focus({ preventScroll: true });
    }
  }, [inDetail]);
  const errorLabel = history.error === 'forbidden' ? 'Bạn không có quyền xem lịch sử này.'
    : history.error === 'missing' ? 'Lịch sử cuộc gọi này không còn khả dụng.' : 'Chưa tải được lịch sử cuộc gọi. Hãy thử lại.';
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent showClose={false} className="messenger-workspace flex flex-col gap-0 bg-background p-0 text-foreground data-[state=open]:animate-none data-[state=closed]:animate-none sm:max-w-xl"
      onCloseAutoFocus={event => {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>(`[data-call-history-trigger="${conversationId ? 'room' : 'own'}"]`)?.focus();
      }}>
      <div className="absolute right-2 top-2"><Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={localizeText('Đóng')}><X size={18} aria-hidden="true" /></Button></div>
      <DialogHeader className="shrink-0 border-b border-border px-4 py-5 pr-14 text-left sm:px-6 sm:pr-14">
        <DialogTitle ref={title} tabIndex={-1}>{localizeText(inDetail ? 'Chi tiết cuộc gọi' : 'Lịch sử cuộc gọi')}</DialogTitle>
        <DialogDescription>{localizeText(conversationId ? 'Các cuộc gọi trong hội thoại này.' : 'Cuộc gọi của bạn trong các hội thoại còn quyền truy cập.')}</DialogDescription>
      </DialogHeader>
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-6">
        {inDetail ? <Button variant="ghost" size="sm" onClick={history.back}><ArrowLeft size={16} aria-hidden="true" />{localizeText('Về lịch sử')}</Button>
          : <label className="space-y-2 text-sm font-medium">{localizeText('Tháng (UTC)')}
            <Input className="[color-scheme:light] dark:[color-scheme:dark]" aria-label={localizeText('Tháng (UTC)')} type="month" value={month} min="1970-01" max={maxMonth}
              onChange={event => { const value = event.target.value; if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= '1970-01' && value <= maxMonth) setMonth(value); }} />
          </label>}
        <Button variant="outline" size="sm" disabled={history.loading} onClick={inDetail ? history.retry : history.refresh} aria-label={localizeText('Tải lại lịch sử cuộc gọi')}>
          <RefreshCw size={16} aria-hidden="true" />{localizeText('Tải lại')}
        </Button>
      </div>
      <div ref={scrollArea} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 sm:min-h-64 sm:px-6" aria-busy={history.loading}>
        {history.loading && (inDetail || !history.items.length) ? <div role="status" aria-label={localizeText('Đang tải lịch sử cuộc gọi…')} className="space-y-5 py-4">
          {[0, 1, 2].map(n => <div key={n} className="space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>)}
        </div> : null}
        {history.detail ? <CallHistoryFacts entry={history.detail} actorId={actorId} /> : null}
        {!inDetail && history.items.length ? <ul className="divide-y divide-border">{history.items.map(entry => {
          const entryKey = `${entry.conversationId}/${entry.callId}`;
          return <li key={entryKey}>
            <button type="button" data-call-history-entry={entryKey}
              className="focus-ring flex w-full items-start gap-3 rounded-md px-2 py-4 text-foreground transition-colors hover:bg-muted active:bg-secondary"
              onClick={() => {
                returnPoint.current = { entryKey, scrollTop: scrollArea.current?.scrollTop ?? 0 };
                history.openDetail(entry);
              }}><CallHistorySummary entry={entry} actorId={actorId} /><ChevronRight size={16} className="mt-1 shrink-0 text-muted-foreground" aria-hidden="true" /></button>
          </li>;
        })}</ul> : null}
        {history.error ? <div role="alert" className="space-y-3 py-6 text-sm leading-6"><p>{localizeText(errorLabel)}</p>
          <Button variant="outline" onClick={history.retry}>{localizeText('Thử lại')}</Button></div> : null}
        {!inDetail && !history.loading && !history.error && !history.items.length ? <div role="status" className="space-y-2 py-8">
          <h3 className="font-semibold">{localizeText(history.hasNext ? 'Chưa thấy cuộc gọi trong phần vừa đọc.' : 'Chưa có cuộc gọi trong tháng này.')}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{localizeText(history.hasNext ? 'Bạn có thể tải tiếp lịch sử.' : 'Chọn tháng khác để xem các cuộc gọi trước.')}</p>
        </div> : null}
        {!inDetail && history.hasNext && !history.error ? <Button variant="outline" loading={history.loading} className="mt-4" onClick={history.loadMore}>{localizeText('Tải thêm cuộc gọi')}</Button> : null}
        {!inDetail && history.limited ? <p role="status" className="py-4 text-sm leading-6 text-muted-foreground">{localizeText('Chưa đọc hết lịch sử tháng này. Hãy tải lại hoặc chọn tháng khác.')}</p> : null}
      </div>
      {!inDetail ? <p className="shrink-0 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-6">{localizeText('Thời gian hiển thị theo UTC.')}</p> : null}
    </DialogContent>
  </Dialog>;
}
