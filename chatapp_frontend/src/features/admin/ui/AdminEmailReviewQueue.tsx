import axios from 'axios';
import { ChevronDown, ClipboardCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { listAdminEmailReview } from '../api/admin-email-delivery.api';
import type { AdminEmailDeliveryKey, AdminEmailReviewEntry } from '../api/admin-email-delivery.api';

const DAY_PATTERN = /^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const utcDay = (offset = 0) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

interface ReviewProps {
  onSelect: (key: AdminEmailDeliveryKey) => void;
  revision?: number;
}

export function AdminEmailReviewQueue({ onSelect, revision }: ReviewProps) {
  const { locale } = useAppLocale();
  const [open, setOpen] = useState(false);

  return (
    <details className="group border-t border-border pt-3" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--radius-sm)] text-sm font-semibold marker:hidden">
        <span className="flex items-center gap-2">
          <ClipboardCheck size={17} className="text-primary" aria-hidden="true" />
          {locale === 'vi' ? 'Email cần kiểm tra' : 'Emails to review'}
        </span>
        <ChevronDown size={17} aria-hidden="true" className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      {open ? <ReviewDay onSelect={onSelect} revision={revision} /> : null}
    </details>
  );
}

function ReviewDay({ onSelect, revision }: ReviewProps) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [day, setDay] = useState(() => utcDay());
  const today = utcDay();
  const yesterday = utcDay(-1);
  const valid = DAY_PATTERN.test(day) && day <= today;

  return (
    <div className="space-y-3 pb-2 pt-3">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <label className="block w-full max-w-56 space-y-1.5 text-sm font-medium">
          <span>{copy('Ngày đưa vào hàng gửi (UTC)', 'Email job date (UTC)')}</span>
          <Input type="date" min="0001-01-01" max={today} value={day} onChange={event => setDay(event.target.value)} />
        </label>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="ghost" aria-pressed={day === today} onClick={() => setDay(today)}>{copy('Hôm nay', 'Today')}</Button>
          <Button type="button" size="sm" variant="ghost" aria-pressed={day === yesterday} onClick={() => setDay(yesterday)}>{copy('Hôm qua', 'Yesterday')}</Button>
        </div>
      </div>
      {valid ? <ReviewResults key={`${day}:${revision ?? 0}`} day={day} onSelect={onSelect} /> : (
        <p className="text-sm text-muted-foreground">{copy('Chọn ngày hiện tại hoặc một ngày trước đó.', 'Choose today or an earlier date.')}</p>
      )}
    </div>
  );
}

function ReviewResults({ day, onSelect }: ReviewProps & { day: string }) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [request, setRequest] = useState<{ cursor?: string }>({});
  const [entries, setEntries] = useState<AdminEmailReviewEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    void listAdminEmailReview(day, request.cursor, controller.signal).then(page => {
      if (controller.signal.aborted) return;
      setEntries(current => request.cursor ? [...current, ...page.content] : page.content);
      setNextCursor(page.nextCursor);
      setState('ready');
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 401 || status === 403) {
        setEntries([]);
        setNextCursor(null);
        setState('denied');
      } else {
        setState('error');
      }
    });
    return () => controller.abort();
  }, [day, request]);

  function load(cursor?: string) {
    setState('loading');
    setRequest({ cursor });
  }

  return (
    <div className="space-y-2">
      {entries.length > 0 ? <ReviewList entries={entries} onSelect={onSelect} /> : null}
      {state === 'loading' ? <p role="status" className="text-sm text-muted-foreground">{copy('Đang tải email cần kiểm tra…', 'Loading emails to review…')}</p> : null}
      {state === 'denied' ? <p role="alert" className="text-sm text-destructive">{copy('Phiên hiện tại không có quyền xem danh sách này.', 'Your current session cannot view this queue.')}</p> : null}
      {state === 'error' ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-destructive">{copy('Không tải được danh sách.', 'Could not load the review queue.')}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => load(request.cursor)}>{copy('Thử lại', 'Retry')}</Button>
        </div>
      ) : null}
      {state === 'ready' && entries.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          {nextCursor ? copy('Trang này chưa có mục cần kiểm tra. Bạn có thể xem tiếp.', 'There are no entries on this page. You can load more.')
            : copy('Ngày này không có email cần kiểm tra.', 'No emails to review for this date.')}
        </p>
      ) : null}
      {state === 'ready' && entries.length > 0 ? (
        <p role="status" className="sr-only">{copy(`Đang hiển thị ${entries.length} mục.`, `Showing ${entries.length} entries.`)}</p>
      ) : null}
      {nextCursor && state !== 'error' ? (
        <Button type="button" size="sm" variant="ghost" loading={state === 'loading'} onClick={() => load(nextCursor)}>
          {copy('Xem thêm', 'Load more')}
        </Button>
      ) : null}
    </div>
  );
}

function ReviewList({ entries, onSelect }: ReviewProps & { entries: AdminEmailReviewEntry[] }) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const formatter = new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <ul className="divide-y divide-border">
      {entries.map(entry => (
        <li key={`${entry.userId}:${entry.month}:${entry.notificationId}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm">
          <div className="min-w-0 space-y-1">
            <p className="break-all font-medium">{entry.notificationId}</p>
            <p className="flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">
              <span>{copy(`Số lần thử ${entry.attempts}`, `Attempts ${entry.attempts}`)}</span>
              {entry.attemptedAt ? <time dateTime={entry.attemptedAt}>{formatter.format(new Date(entry.attemptedAt))}</time> : null}
            </p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => onSelect(entry)}
            aria-label={copy(`Điền mã tra cứu ${entry.notificationId}`, `Fill lookup for ${entry.notificationId}`)}>
            {copy('Điền mã tra cứu', 'Fill lookup')}
          </Button>
        </li>
      ))}
    </ul>
  );
}
