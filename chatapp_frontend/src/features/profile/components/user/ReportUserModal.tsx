import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { submitUserReport } from '@/features/moderation/api/report.api';
import { localizeText } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { Button, ModalShell, Select, Textarea } from '@/shared/ui';

interface ReportUserModalProps {
  userId: string;
  displayName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const REASONS = [
  { value: 'SPAM', label: 'Spam hoặc lừa đảo' },
  { value: 'HARASSMENT', label: 'Quấy rối hoặc bắt nạt' },
  { value: 'HATE_SPEECH', label: 'Ngôn từ thù ghét' },
  { value: 'SEXUAL_CONTENT', label: 'Nội dung tình dục' },
  { value: 'IMPERSONATION', label: 'Mạo danh người khác' },
  { value: 'OTHER', label: 'Lý do khác' },
] as const;

export const ReportUserModal = ({ userId, displayName, onClose, onSubmitted }: ReportUserModalProps) => {
  const [reasonCode, setReasonCode] = useState<string>(REASONS[0].value);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const submitRequestRef = useRef(0);

  useEffect(() => {
    submitRequestRef.current += 1;
    setReasonCode(REASONS[0].value);
    setDescription('');
    setError(null);
    setIsSubmitting(false);
  }, [userId]);

  useEffect(() => () => {
    mountedRef.current = false;
    submitRequestRef.current += 1;
  }, []);

  const canSubmit = useMemo(
    () => Boolean(userId && reasonCode && !isSubmitting),
    [isSubmitting, reasonCode, userId],
  );

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError(localizeText('Không thể gửi báo cáo cho hồ sơ này.'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const requestId = ++submitRequestRef.current;
    const targetUserId = userId;
    try {
      await submitUserReport({
        targetType: 'USER',
        targetUserId: userId,
        reasonCode,
        description: description.trim() || undefined,
      });
      if (!mountedRef.current || requestId !== submitRequestRef.current || targetUserId !== userId) return;
      onSubmitted();
      onClose();
    } catch (submitError) {
      if (!mountedRef.current || requestId !== submitRequestRef.current || targetUserId !== userId) return;
      setError(getUserFacingErrorMessage(submitError, 'Không thể gửi báo cáo. Vui lòng thử lại.'));
    } finally {
      if (mountedRef.current && requestId === submitRequestRef.current) setIsSubmitting(false);
    }
  };

  return (
    <ModalShell open title={localizeText('Báo cáo hồ sơ')} description={localizeText('Báo cáo sẽ được đội ngũ an toàn xem xét bảo mật.')} onClose={onClose} closeDisabled={isSubmitting} showClose={false} className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col overflow-hidden border-0 bg-card/95 p-0 sm:h-auto sm:max-h-[85vh] sm:max-w-md sm:rounded-[var(--radius-lg)] sm:border">
        <div className="flex items-start justify-between border-b border-border/50 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-[var(--radius-md)] bg-warning/15 p-2.5 text-warning">
              <AlertTriangle size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="report-user-title" className="text-lg font-black tracking-tight">{localizeText('Báo cáo hồ sơ')}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{localizeText('Báo cáo sẽ được đội ngũ an toàn xem xét bảo mật.')}</p>
            </div>
          </div>
          <Button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label={localizeText('Đóng')}
            variant="ghost"
            size="icon"
          >
            <X size={18} aria-hidden="true" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          <div className="rounded-[var(--radius-md)] border border-border/50 bg-background/40 p-3 text-sm">
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{localizeText('Hồ sơ được chọn')}</p>
            <p className="truncate font-semibold text-foreground/80">{displayName}</p>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{localizeText('Lý do')}</span>
            <Select
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
              disabled={isSubmitting}
              className="font-semibold"
            >
              {REASONS.map((reason) => <option key={reason.value} value={reason.value}>{localizeText(reason.label)}</option>)}
            </Select>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{localizeText('Mô tả thêm')} <span className="font-medium normal-case tracking-normal">({localizeText('không bắt buộc')})</span></span>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting}
              maxLength={2000}
              rows={4}
              placeholder={localizeText('Mô tả ngắn gọn vấn đề...')}
            />
            <span className="block text-right text-[10px] text-muted-foreground/60">{description.length}/2000</span>
          </label>

          {error ? <p role="alert" className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>{localizeText('Hủy')}</Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit} loading={isSubmitting}>
              {isSubmitting ? localizeText('Đang gửi...') : localizeText('Gửi báo cáo')}
            </Button>
          </div>
        </div>
    </ModalShell>
  );
};
