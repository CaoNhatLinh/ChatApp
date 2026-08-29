import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Message } from '../../types/messenger.types';
import { submitMessageReport } from '@/features/moderation/api/report.api';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import { localizeText } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';

interface ReportMessageModalProps {
  message: Message | null;
  onClose: () => void;
  onSubmitted: () => void;
}

const REASONS = [
  { value: 'SPAM', label: 'Spam hoặc lừa đảo' },
  { value: 'HARASSMENT', label: 'Quấy rối hoặc bắt nạt' },
  { value: 'HATE_SPEECH', label: 'Ngôn từ thù ghét' },
  { value: 'SEXUAL_CONTENT', label: 'Nội dung tình dục' },
  { value: 'VIOLENCE', label: 'Bạo lực hoặc đe doạ' },
  { value: 'OTHER', label: 'Lý do khác' },
] as const;

export const ReportMessageModal = ({ message, onClose, onSubmitted }: ReportMessageModalProps) => {
  const [reasonCode, setReasonCode] = useState<string>(REASONS[0].value);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const submitRequestRef = useRef(0);

  useEffect(() => {
    submitRequestRef.current += 1;
    if (!message) {
      setIsSubmitting(false);
      setError(null);
      return;
    }
    setReasonCode(REASONS[0].value);
    setDescription('');
    setError(null);
    setIsSubmitting(false);
  }, [message]);

  useEffect(() => () => {
    mountedRef.current = false;
    submitRequestRef.current += 1;
  }, []);

  useFocusTrap(Boolean(message), dialogRef, onClose, isSubmitting);

  const canSubmit = useMemo(
    () => Boolean(message?.messageBucket && message.messageId && !isSubmitting),
    [isSubmitting, message],
  );

  if (!message) return null;

  const handleSubmit = async () => {
    const messageBucket = message.messageBucket;
    if (!canSubmit || !messageBucket) {
      setError(localizeText('Tin nhắn này chưa có đủ thông tin để báo cáo.'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const requestId = ++submitRequestRef.current;
    const messageIdentity = `${message.conversationId}:${message.messageBucket}:${message.messageId}`;
    try {
      await submitMessageReport({
        targetType: 'MESSAGE',
        conversationId: message.conversationId,
        messageBucket,
        messageId: message.messageId,
        reasonCode,
        description: description.trim() || undefined,
      });
      if (
        !mountedRef.current ||
        requestId !== submitRequestRef.current ||
        !message ||
        messageIdentity !== `${message.conversationId}:${message.messageBucket}:${message.messageId}`
      ) return;
      onSubmitted();
      onClose();
    } catch (submitError) {
      if (
        !mountedRef.current ||
        requestId !== submitRequestRef.current ||
        !message ||
        messageIdentity !== `${message.conversationId}:${message.messageBucket}:${message.messageId}`
      ) return;
      setError(getUserFacingErrorMessage(submitError, 'Không thể gửi báo cáo. Vui lòng thử lại.'));
    } finally {
      if (mountedRef.current && requestId === submitRequestRef.current) setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label={localizeText('Đóng báo cáo')}
        className="absolute inset-0 bg-background/60 backdrop-blur-md"
        onClick={isSubmitting ? undefined : onClose}
      />
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-message-title"
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
              <h2 id="report-message-title" className="text-lg font-black tracking-tight">{localizeText('Báo cáo tin nhắn')}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{localizeText('Báo cáo sẽ được chuyển tới đội ngũ an toàn để xem xét.')}</p>
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
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{localizeText('Tin nhắn được chọn')}</p>
            <p className="line-clamp-3 break-words text-foreground/80">{message.content || localizeText('Tệp đính kèm')}</p>
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
