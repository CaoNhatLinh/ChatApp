import axios from 'axios';
import { ChevronDown, MailSearch, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { emailDeliveryStatusLabels } from '@/features/notifications/model/email-delivery-status';
import { getAdminEmailDelivery } from '../api/admin-email-delivery.api';
import type { AdminEmailDelivery, AdminEmailDeliveryKey } from '../api/admin-email-delivery.api';
import { AdminEmailReviewQueue } from './AdminEmailReviewQueue';
import { CloseEmailReview } from './CloseEmailReview';

const ACCOUNT_ID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const NOTIFICATION_ID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-1[0-9a-fA-F]{3}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

type LookupState =
  | { kind: 'idle' | 'loading' | 'missing' | 'denied' | 'error' }
  | { kind: 'ready'; delivery: AdminEmailDelivery; key: AdminEmailDeliveryKey };

export function AdminEmailDeliveryLookup() {
  const { locale } = useAppLocale();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [queueRevision, setQueueRevision] = useState(0);
  const [selection, setSelection] = useState<{ key: AdminEmailDeliveryKey; revision: number } | null>(null);
  const lookup = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);

  function fillLookup(key: AdminEmailDeliveryKey) {
    if (closing) return;
    setSelection(previous => ({ key, revision: (previous?.revision ?? 0) + 1 }));
    if (lookup.current) lookup.current.open = true;
    summary.current?.focus();
  }

  return (
    <>
      <AdminEmailReviewQueue onSelect={fillLookup} revision={queueRevision} />
      <details ref={lookup} className="group border-t border-border pt-3" onToggle={event => {
        const isOpen = event.currentTarget.open;
        if (!isOpen && closing) {
          event.currentTarget.open = true;
          return;
        }
        setOpen(isOpen);
        if (!isOpen) setSelection(null);
      }}>
        <summary ref={summary} className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--radius-sm)] text-sm font-semibold marker:hidden">
          <span className="flex items-center gap-2">
            <MailSearch size={17} className="text-primary" aria-hidden="true" />
            {locale === 'vi' ? 'Tra cứu gửi email' : 'Email delivery lookup'}
          </span>
          <ChevronDown size={17} aria-hidden="true" className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        {open ? <LookupForm key={selection?.revision ?? 0} initialKey={selection?.key} closing={closing}
          onBusyChange={setClosing} onRefreshQueue={() => setQueueRevision(value => value + 1)} /> : null}
      </details>
    </>
  );
}

function LookupForm({ initialKey, closing, onBusyChange, onRefreshQueue }: {
  initialKey?: AdminEmailDeliveryKey;
  closing: boolean;
  onBusyChange: (busy: boolean) => void;
  onRefreshQueue: () => void;
}) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const request = useRef<AbortController | null>(null);
  const [state, setState] = useState<LookupState>({ kind: 'idle' });
  useEffect(() => () => request.current?.abort(), []);

  function clearResult() {
    request.current?.abort();
    setState({ kind: 'idle' });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (closing) return;
    const fields = new FormData(event.currentTarget);
    const userId = fields.get('userId');
    const month = fields.get('month');
    const notificationId = fields.get('notificationId');
    if (typeof userId !== 'string' || typeof month !== 'string' || typeof notificationId !== 'string') return;
    await load({
      userId: userId.trim(),
      month,
      notificationId: notificationId.trim(),
    });
  }

  async function load(key: AdminEmailDeliveryKey) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ kind: 'loading' });
    try {
      const delivery = await getAdminEmailDelivery(key, controller.signal);
      if (!controller.signal.aborted) setState({ kind: 'ready', delivery, key });
    } catch (error) {
      if (controller.signal.aborted) return;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 404) setState({ kind: 'missing' });
      else if (status === 401 || status === 403) setState({ kind: 'denied' });
      else setState({ kind: 'error' });
    }
  }

  return (
    <div className="space-y-4 pb-2 pt-3">
      <p className="text-sm text-muted-foreground">{copy('Dùng mã trong lịch sử gửi email của người dùng.', 'Use the identifiers from the member’s email delivery history.')}</p>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit} onChange={clearResult}>
        <label className="min-w-0 space-y-1.5 text-sm font-medium">
          <span>{copy('ID tài khoản', 'Account ID')}</span>
          <Input name="userId" required pattern={ACCOUNT_ID} spellCheck={false} autoComplete="off" defaultValue={initialKey?.userId} disabled={closing} />
        </label>
        <label className="min-w-0 space-y-1.5 text-sm font-medium">
          <span>{copy('Tháng lưu (UTC)', 'Record month (UTC)')}</span>
          <Input name="month" type="month" min="0001-01" max="9999-12" required defaultValue={initialKey?.month} disabled={closing} />
        </label>
        <label className="min-w-0 space-y-1.5 text-sm font-medium sm:col-span-2">
          <span>{copy('ID thông báo', 'Notification ID')}</span>
          <Input name="notificationId" required pattern={NOTIFICATION_ID} spellCheck={false} autoComplete="off" defaultValue={initialKey?.notificationId} disabled={closing} />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" loading={state.kind === 'loading'} disabled={closing}>
            <Search size={16} aria-hidden="true" />{copy('Tra cứu', 'Look up')}
          </Button>
        </div>
      </form>
      {state.kind === 'loading' ? <p role="status" className="sr-only">{copy('Đang tra cứu.', 'Looking up the delivery.')}</p> : null}
      {state.kind === 'missing' ? <p role="status" className="text-sm text-muted-foreground">{copy('Không tìm thấy bản ghi gửi email này.', 'No email delivery matches these identifiers.')}</p> : null}
      {state.kind === 'denied' ? <p role="alert" className="text-sm text-destructive">{copy('Phiên hiện tại không có quyền tra cứu.', 'Your current session cannot look up deliveries.')}</p> : null}
      {state.kind === 'error' ? <p role="alert" className="text-sm text-destructive">{copy('Không tra cứu được. Hãy kiểm tra thông tin và thử lại.', 'Lookup failed. Check the identifiers and try again.')}</p> : null}
      {state.kind === 'ready' ? <DeliveryResult delivery={state.delivery} /> : null}
      {state.kind === 'ready' && state.delivery.status === 'REVIEW_REQUIRED' && !state.delivery.reviewedAt ? (
        <CloseEmailReview deliveryKey={state.key} onBusyChange={onBusyChange}
          onClosed={reviewedAt => {
            setState({ ...state, delivery: { ...state.delivery, reviewedAt } });
            onRefreshQueue();
          }}
          onRecheck={() => {
            onRefreshQueue();
            void load(state.key);
          }} />
      ) : null}
    </div>
  );
}

function DeliveryResult({ delivery }: { delivery: AdminEmailDelivery }) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const status = delivery.status === 'REVIEW_REQUIRED' && delivery.reviewedAt
    ? copy('Chưa xác định kết quả gửi', 'Delivery outcome unknown')
    : copy(...emailDeliveryStatusLabels[delivery.status]);
  const formatter = new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const dates = [
    { label: copy('Lần thử gần nhất', 'Last attempt'), value: delivery.attemptedAt },
    { label: copy('Lịch thử lại', 'Scheduled retry'), value: delivery.retryAt },
    { label: copy('Đã giao lúc', 'Delivered at'), value: delivery.deliveredAt },
    { label: copy('Đã kết thúc rà soát', 'Review closed'), value: delivery.reviewedAt },
  ];
  return (
    <div className="rounded-[var(--radius-md)] bg-muted/35 p-4" role="status">
      <p className="text-sm font-semibold">{status}</p>
      <dl className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">{copy('Số lần thử', 'Attempts')}</dt><dd>{delivery.attempts}</dd></div>
        {dates.map(({ label, value }) => value ? (
          <div key={label}><dt className="text-muted-foreground">{label}</dt><dd><time dateTime={value}>{formatter.format(new Date(value))}</time></dd></div>
        ) : null)}
      </dl>
    </div>
  );
}
