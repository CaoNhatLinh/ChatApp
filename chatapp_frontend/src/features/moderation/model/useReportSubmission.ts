import { useEffect, useRef, useState } from 'react';
import { getSessionGeneration } from '@/shared/auth/access-token';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { submitReport, type CreateReportInput } from '../api/report.api';
import { completeReportRetry, reportDraftFingerprint, reserveReportRetryKey } from './reportRetryStorage';

interface ReportAttempt {
  draft: string;
  generation: number;
  key: string;
  pending: boolean;
}

export function useReportSubmission(targetKey: string | null, onSubmitted: () => void, onClose: () => void) {
  const attemptRef = useRef<ReportAttempt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsSubmitting(false);
    setError(null);
    return () => { attemptRef.current = null; };
  }, [targetKey]);

  const submit = async (input: CreateReportInput) => {
    const previous = attemptRef.current;
    if (previous?.pending) return;
    const generation = getSessionGeneration();
    const reporterId = useAuthStore.getState().user?.userId;
    const draft = JSON.stringify(input);
    const key = previous?.generation === generation && previous.draft === draft
      ? previous.key : crypto.randomUUID();
    const attempt = { draft, generation, key, pending: true };
    attemptRef.current = attempt;
    const ownsResult = () => attemptRef.current === attempt && generation === getSessionGeneration();

    setIsSubmitting(true);
    setError(null);
    try {
      const fingerprint = reporterId ? await reportDraftFingerprint(reporterId, draft) : undefined;
      if (!ownsResult()) return;
      if (fingerprint) attempt.key = reserveReportRetryKey(fingerprint, key);
      await submitReport(input, attempt.key);
      if (!ownsResult()) return;
      if (fingerprint) completeReportRetry(fingerprint, attempt.key);
      attemptRef.current = null;
      setIsSubmitting(false);
      onSubmitted();
      onClose();
    } catch (submitError) {
      if (ownsResult()) setError(getUserFacingErrorMessage(submitError, 'Không thể gửi báo cáo. Vui lòng thử lại.'));
    } finally {
      attempt.pending = false;
      if (ownsResult()) setIsSubmitting(false);
    }
  };

  return { submit, isSubmitting, error, setError };
}
