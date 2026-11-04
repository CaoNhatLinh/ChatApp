import { useEffect, useId, useState } from 'react';
import { ChevronDown, Mail } from 'lucide-react';
import { listEmailHistory, type EmailHistoryPage } from '@/features/notifications/api/notifications.api';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { emailDeliveryStatusLabels } from '../model/email-delivery-status';

const currentMonth = () => new Date().toISOString().slice(0, 7);
const MONTH_PATTERN = /^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/;

export function EmailHistorySection() {
  const { locale } = useAppLocale();
  const actorId = useAuthStore(state => state.user?.userId);
  const [open, setOpen] = useState(false);
  return (
    <details className="group py-1" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--radius-sm)] text-sm font-semibold marker:hidden">
        <span className="flex items-center gap-2">
          <Mail size={17} className="text-primary" aria-hidden="true" />
          {locale === 'vi' ? 'Lịch sử gửi email' : 'Email delivery history'}
        </span>
        <ChevronDown size={17} aria-hidden="true" className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      {open && actorId ? <EmailHistory key={actorId} actorId={actorId} /> : null}
    </details>
  );
}

function EmailHistory({ actorId }: { actorId: string }) {
  const { locale } = useAppLocale();
  const [month, setMonth] = useState(currentMonth);
  const monthId = useId();
  return (
    <div className="space-y-3 pb-2 pt-3">
      <label className="block w-full max-w-56 space-y-1.5 text-sm font-medium" htmlFor={monthId}>
        <span>{locale === 'vi' ? 'Tháng (UTC)' : 'Month (UTC)'}</span>
        <Input id={monthId} type="month" min="0001-01" max={currentMonth()} value={month}
          onChange={event => setMonth(event.target.value)} />
      </label>
      {MONTH_PATTERN.test(month) && month <= currentMonth() ? <EmailHistoryResults key={month} month={month} actorId={actorId} /> : (
        <p className="text-sm text-muted-foreground">
          {locale === 'vi' ? 'Chọn tháng hiện tại hoặc một tháng trước đó.' : 'Choose the current month or an earlier month.'}
        </p>
      )}
    </div>
  );
}

function EmailHistoryResults({ month, actorId }: { month: string; actorId: string }) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [request, setRequest] = useState<{ cursor?: string }>({});
  const [entries, setEntries] = useState<EmailHistoryPage['content']>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const dateFormatter = new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  });

  useEffect(() => {
    const controller = new AbortController();
    void listEmailHistory({ month, cursor: request.cursor }, controller.signal)
      .then(page => {
        if (controller.signal.aborted) return;
        setEntries(current => request.cursor ? [...current, ...page.content] : page.content);
        setNextCursor(page.hasNext ? page.nextCursor : null);
        setState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error');
      });
    return () => controller.abort();
  }, [month, request]);

  const load = (cursor?: string) => {
    setState('loading');
    setRequest({ cursor });
  };

  return (
    <div className="space-y-2">
      {entries.length > 0 ? (
        <ul className="divide-y divide-border">
          {entries.map(entry => {
            const label = emailDeliveryStatusLabels[entry.status] ?? emailDeliveryStatusLabels.UNKNOWN;
            const time = entry.status === 'DELIVERED' ? entry.deliveredAt : entry.attemptedAt;
            return (
              <li key={entry.notificationId} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-medium">{copy(...label)}</span>
                {time ? <time dateTime={time} className="text-xs tabular-nums text-muted-foreground">{dateFormatter.format(new Date(time))}</time> : null}
                <details className="w-full text-xs text-muted-foreground">
                  <summary className="focus-ring w-fit cursor-pointer rounded-sm py-1">{copy('Mã tra cứu', 'Lookup details')}</summary>
                  <dl className="space-y-1 py-1 break-all">
                    <div><dt className="inline font-medium">{copy('ID tài khoản', 'Account ID')} </dt><dd className="inline">{actorId}</dd></div>
                    <div><dt className="inline font-medium">{copy('Tháng (UTC)', 'Month (UTC)')} </dt><dd className="inline">{month}</dd></div>
                    <div><dt className="inline font-medium">{copy('ID thông báo', 'Notification ID')} </dt><dd className="inline">{entry.notificationId}</dd></div>
                  </dl>
                </details>
              </li>
            );
          })}
        </ul>
      ) : null}
      {state === 'loading' ? <p role="status" className="text-sm text-muted-foreground">{copy('Đang tải lịch sử email…', 'Loading email history…')}</p> : null}
      {state === 'error' ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-destructive">{copy('Không tải được lịch sử email.', 'Could not load email history.')}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => load(request.cursor)}>{copy('Thử lại', 'Retry')}</Button>
        </div>
      ) : null}
      {state === 'ready' && entries.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          {nextCursor ? copy('Chưa có mục trong phần này. Bạn có thể xem tiếp.', 'No entries here yet. You can load more.')
            : copy('Chưa có lịch sử gửi email trong tháng này.', 'No email delivery history for this month.')}
        </p>
      ) : null}
      {state === 'ready' && entries.length > 0 ? (
        <p role="status" className="sr-only">
          {copy(`Đang hiển thị ${entries.length} mục.`, `Showing ${entries.length} entries.`)}
        </p>
      ) : null}
      {nextCursor && state !== 'error' ? (
        <Button type="button" size="sm" variant="ghost" loading={state === 'loading'} onClick={() => load(nextCursor)}>
          {copy('Xem thêm', 'Load more')}
        </Button>
      ) : null}
    </div>
  );
}
