import { useEffect, useState } from 'react';
import { AlertCircle, Flag, Loader2 } from 'lucide-react';
import { listMyReports, type ReportRecord } from '@/features/moderation/api/report.api';
import { localizeText } from '@/shared/i18n';
import { logger } from '@/shared/lib/logger';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';

const STATUS_LABEL_KEYS: Record<ReportRecord['status'], string> = {
  OPEN: 'Đang chờ xem xét',
  IN_REVIEW: 'Đang xử lý',
  RESOLVED: 'Đã xử lý',
  DISMISSED: 'Không vi phạm',
};

const STATUS_CLASSES: Record<ReportRecord['status'], string> = {
  OPEN: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  IN_REVIEW: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  RESOLVED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  DISMISSED: 'border-border/60 bg-muted/50 text-muted-foreground',
};

export const ReportHistoryPanel = () => {
  const statusLabels = Object.fromEntries(
    Object.entries(STATUS_LABEL_KEYS).map(([status, label]) => [status, localizeText(label)]),
  ) as Record<ReportRecord['status'], string>;
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void listMyReports()
      .then((result) => {
        if (active) setReports(result);
      })
      .catch((loadError: unknown) => {
        if (active) {
          logger.warn('Report history load failed', loadError instanceof Error ? loadError.message : String(loadError));
          setError(getUserFacingErrorMessage(loadError, localizeText('Không thể tải lịch sử báo cáo. Bạn có thể thử lại sau.')));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retryToken]);

  return (
    <section className="mt-10 space-y-4" aria-labelledby="report-history-title">
      <div>
        <h2 id="report-history-title" className="text-2xl font-black uppercase tracking-tight">{localizeText('Báo cáo của tôi')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{localizeText('Theo dõi những báo cáo bạn đã gửi và trạng thái xem xét.')}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-border/60 bg-card/60 p-10" role="status">
          <Loader2 className="animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">{localizeText('Đang tải lịch sử báo cáo')}</span>
        </div>
      ) : error ? (
        <div className="flex items-start justify-between gap-3 rounded-3xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setRetryToken((current) => current + 1)} className="focus-ring shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
            {localizeText('Thử lại')}
          </button>
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          {localizeText('Bạn chưa gửi báo cáo nào.')}
        </div>
      ) : (
        <div className="space-y-3" aria-live="polite">
          {reports.map((report) => {
            const status = report.status;
            return (
              <article key={report.reportId} className="rounded-3xl border border-border/60 bg-card/60 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-2xl bg-primary/10 p-2 text-primary"><Flag size={16} aria-hidden="true" /></div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{report.reasonCode}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{report.targetType} · {localizeText('ngày gửi')} {report.reportDay}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${STATUS_CLASSES[status]}`}>
                    {statusLabels[status]}
                  </span>
                </div>
                {report.description ? <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{report.description}</p> : null}
                <p className="mt-3 text-[11px] text-muted-foreground/70">{localizeText('Mã báo cáo')}: {report.reportId}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
