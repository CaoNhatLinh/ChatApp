import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { ConversationEntry } from '@/features/messenger/model/messenger.store.types';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Skeleton';

interface Props {
  entry: ConversationEntry | null;
  onRetry: () => void;
  onBack: () => void;
}

export function ConversationEntryState({ entry, onRetry, onBack }: Props) {
  useAppLocale();
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const error = entry?.status === 'error' ? entry : null;
  useEffect(() => {
    if (entry?.status === 'error' && (document.activeElement === document.body || panel.current?.contains(document.activeElement))) {
      heading.current?.focus();
    }
  }, [entry?.requestId, entry?.status]);
  const message = !error ? '' : error.reason === 'forbidden'
    ? localizeText('Bạn không có quyền xem cuộc trò chuyện này.')
    : error.reason === 'missing' ? localizeText('Cuộc trò chuyện này không còn khả dụng.')
    : error.reason === 'invalid' ? localizeText('Liên kết cuộc trò chuyện không hợp lệ.')
    : localizeText('Chưa tải được dữ liệu. Hãy thử lại hoặc chọn cuộc trò chuyện khác.');

  return <section ref={panel} className="flex h-full min-h-0 flex-col overflow-y-auto bg-background pb-20 text-foreground md:pb-0" aria-label={localizeText('Mở cuộc trò chuyện')}>
    <div className="shrink-0 border-b border-border px-4 py-3">
      <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft aria-hidden="true" className="h-4 w-4" />{localizeText('Danh sách hội thoại')}</Button>
    </div>
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      {error ? <div role="alert" className="w-full max-w-md">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold tracking-tight focus:outline-none">{localizeText('Chưa mở được cuộc trò chuyện')}</h2>
        <p className="mt-3 text-base leading-7 text-muted-foreground">{message}</p>
        {error.reason === 'unavailable' ? <Button type="button" className="mt-6" onClick={onRetry}>{localizeText('Thử lại')}</Button> : null}
      </div> : <div role="status" aria-busy="true" className="w-full max-w-md">
        <p className="text-base font-medium">{localizeText('Đang mở cuộc trò chuyện...')}</p>
        <div aria-hidden="true" className="mt-6 space-y-4">
          <Skeleton className="h-12 w-3/4 motion-reduce:animate-none" />
          <Skeleton className="ml-auto h-12 w-2/3 motion-reduce:animate-none" />
        </div>
      </div>}
    </div>
  </section>;
}
