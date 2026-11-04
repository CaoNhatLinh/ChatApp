import axios from 'axios';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { closeAdminEmailReview } from '../api/admin-email-delivery.api';
import type { AdminEmailDeliveryKey, EmailReviewCommand } from '../api/admin-email-delivery.api';

const REASON_LIMIT = 300;

interface CloseEmailReviewProps {
  deliveryKey: AdminEmailDeliveryKey;
  onClosed: (reviewedAt: string) => void;
  onRecheck: () => void;
  onBusyChange: (busy: boolean) => void;
}

export function CloseEmailReview({ deliveryKey, onClosed, onRecheck, onBusyChange }: CloseEmailReviewProps) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const reasonId = useId();
  const request = useRef<AbortController | null>(null);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<EmailReviewCommand | null>(null);
  const [error, setError] = useState<'unknown' | 'rejected' | 'denied' | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason.trim()) setConfirming(true);
  }

  async function save(command: EmailReviewCommand) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setConfirming(false);
    setSaving(true);
    onBusyChange(true);
    setPending(command);
    setError(null);
    try {
      const reviewedAt = await closeAdminEmailReview(deliveryKey, command, controller.signal);
      if (!controller.signal.aborted) onClosed(reviewedAt);
    } catch (failure) {
      if (controller.signal.aborted) return;
      const status = axios.isAxiosError(failure) ? failure.response?.status : undefined;
      if (status === 409 || status === 404) {
        onRecheck();
      } else if (status === 401 || status === 403 || status === 400 || status === 422) {
        setPending(null);
        setError(status === 401 || status === 403 ? 'denied' : 'rejected');
      } else {
        setError('unknown');
      }
    } finally {
      request.current = null;
      if (!controller.signal.aborted) {
        setSaving(false);
        onBusyChange(false);
      }
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={confirm} className="space-y-2">
        <label htmlFor={reasonId} className="block text-sm font-medium">{copy('Lý do kết thúc rà soát', 'Reason for closing')}</label>
        <textarea id={reasonId} value={reason} onChange={event => setReason(event.target.value)}
          rows={2} required maxLength={REASON_LIMIT} disabled={Boolean(pending)}
          className="field-control w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm" />
        {pending ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" loading={saving} onClick={() => void save(pending)}>
              {copy('Thử lại thao tác này', 'Retry same closure')}
            </Button>
          </div>
        ) : (
          <Button type="submit" size="sm" variant="outline" disabled={!reason.trim() || error === 'denied'}>
            {copy('Kết thúc rà soát', 'Close review')}
          </Button>
        )}
      </form>
      {error === 'unknown' ? <p role="alert" className="text-sm text-muted-foreground">
        {copy('Chưa xác nhận được kết quả. Thử lại sẽ giữ nguyên yêu cầu. Nếu rời mục này, hãy tra cứu lại trạng thái trước khi thao tác.',
          'The result is unconfirmed. Retry uses the same request. If you leave this section, check the current status before acting again.')}
      </p> : null}
      {error === 'denied' ? <p role="alert" className="text-sm text-destructive">{copy('Phiên hiện tại không có quyền kết thúc rà soát.', 'Your current session cannot close reviews.')}</p> : null}
      {error === 'rejected' ? <p role="alert" className="text-sm text-destructive">{copy('Không lưu được. Kiểm tra lại lý do.', 'Could not save. Check the reason.')}</p> : null}
      <ConfirmDialog open={confirming} onOpenChange={setConfirming}
        title={copy('Kết thúc rà soát email?', 'Close this review?')}
        description={copy('Thao tác này chỉ ghi nhận lý do và đưa mục ra khỏi hàng chờ rà soát.', 'This only records the reason and removes the item from the review queue.')}
        confirmLabel={copy('Xác nhận kết thúc', 'Confirm closure')}
        onConfirm={() => save({ commandId: crypto.randomUUID(), reason: reason.trim() })} />
    </div>
  );
}
