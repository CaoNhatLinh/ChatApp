import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { submitUserReport } from '@/features/moderation/api/report.api';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import { localizeText } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';

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
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReasonCode(REASONS[0].value);
    setDescription('');
    setError(null);
    setIsSubmitting(false);
  }, [userId]);

  const canSubmit = useMemo(
    () => Boolean(userId && reasonCode && !isSubmitting),
    [isSubmitting, reasonCode, userId],
  );

  useFocusTrap(Boolean(userId), dialogRef, onClose, isSubmitting);

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError(localizeText('Không thể gửi báo cáo cho hồ sơ này.'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await submitUserReport({
        targetType: 'USER',
        targetUserId: userId,
        reasonCode,
        description: description.trim() || undefined,
      });
      onSubmitted();
      onClose();
    } catch (submitError) {
      setError(getUserFacingErrorMessage(submitError, 'Không thể gửi báo cáo. Vui lòng thử lại.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label={localizeText('Đóng báo cáo hồ sơ')}
        className="absolute inset-0 bg-background/60 backdrop-blur-md"
        onClick={isSubmitting ? undefined : onClose}
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-user-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border/60 bg-card/95 neo-shadow"
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.zoomReveal}
      >
        <div className="flex items-start justify-between border-b border-border/50 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-amber-500/10 p-2.5 text-amber-600">
              <AlertTriangle size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="report-user-title" className="text-lg font-black tracking-tight">{localizeText('Báo cáo hồ sơ')}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{localizeText('Báo cáo sẽ được đội ngũ an toàn xem xét bảo mật.')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label={localizeText('Đóng')}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-border/50 bg-background/40 p-3 text-sm">
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{localizeText('Hồ sơ được chọn')}</p>
            <p className="truncate font-semibold text-foreground/80">{displayName}</p>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{localizeText('Lý do')}</span>
            <select
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-semibold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {REASONS.map((reason) => <option key={reason.value} value={reason.value}>{localizeText(reason.label)}</option>)}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{localizeText('Mô tả thêm')} <span className="font-medium normal-case tracking-normal">({localizeText('không bắt buộc')})</span></span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting}
              maxLength={2000}
              rows={4}
              placeholder={localizeText('Mô tả ngắn gọn vấn đề...')}
              className="w-full resize-none rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <span className="block text-right text-[10px] text-muted-foreground/60">{description.length}/2000</span>
          </label>

          {error ? <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-2xl px-4 py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-background/70 disabled:opacity-50">{localizeText('Hủy')}</button>
            <button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              {isSubmitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
              {isSubmitting ? localizeText('Đang gửi...') : localizeText('Gửi báo cáo')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
