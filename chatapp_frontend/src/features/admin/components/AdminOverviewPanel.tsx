import { ArrowRight, ArrowUpRight, Check, CircleAlert, Server } from 'lucide-react';
import { useId } from 'react';
import type { AdminConversationSummary, AdminHealthSnapshot, AdminReport } from '../api/admin.api';
import { AdminRoomGallery } from './AdminRoomGallery';
import { AdminDirectoryArt } from './AdminDirectoryArt';
import { ReportTargetIcon } from './AdminReportDetail';
import { reportReasonLabel, reportStateLabel, reportTargetLabel } from './report-labels';
import { useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './AdminOverviewPanel.module.css';

function ReportQueueArtwork({ pending }: { pending: boolean }) {
  return <svg className={styles.artwork} viewBox="0 0 220 124" aria-hidden="true" fill="none">
    <path d="M26 88c34-33 135-44 167-18 26 21-29 43-93 42C46 112 9 104 26 88Z" className={styles.orbit} />
    <circle cx="190" cy="69" r="4" className={styles.spark} />
    <circle cx="38" cy="91" r="3" className={styles.spark} />
    <g className={styles.backSheet}>
      <rect x="71" y="24" width="70" height="76" rx="11" className={styles.paper} />
      <path d="M86 44h40m-40 12h27" className={styles.rule} />
    </g>
    <g className={styles.frontSheet}>
      <rect x="83" y="27" width="70" height="76" rx="11" className={styles.paper} />
      <path d="M99 47h38m-38 12h26m-26 12h15" className={styles.rule} />
    </g>
    <g className={styles.stamp}>
      <circle cx="147" cy="83" r="21" className={styles.seal} />
      {pending
        ? <path d="M147 73v11m0 7h.01" className={styles.sealMark} />
        : <path d="m139 83 5 5 11-11" className={styles.sealMark} />}
    </g>
  </svg>;
}

export function AdminOverviewPanel({ rooms, reports, health, roomsLoading, reportsLoading, roomsError, reportsError, month, reportDay, reportFilter, canReadRooms, canReadReports, onRooms, onReports, onRoom, onReport, onRetryRooms }: {
  rooms: AdminConversationSummary[]; reports: AdminReport[]; health: AdminHealthSnapshot | null;
  roomsLoading: boolean; reportsLoading: boolean; month: string; reportDay: string; reportFilter: AdminReport['status'];
  roomsError: string | null; reportsError: string | null;
  canReadRooms: boolean; canReadReports: boolean; onRooms: () => void; onReports: () => void; onRoom: (room: AdminConversationSummary) => void;
  onReport: (report: AdminReport) => void; onRetryRooms: () => void;
}) {
  const { locale } = useAppLocale();
  const reportSummaryId = useId();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const visibleReports = reports.filter(report => report.status === reportFilter);
  const pending = reportFilter === 'OPEN' || reportFilter === 'IN_REVIEW';
  const up = health?.cassandra?.startsWith('UP');
  const reportStatus = reportsLoading ? copy('Đang tải…', 'Loading…') : reportsError ? copy('Chưa tải được', 'Unavailable')
    : `${visibleReports.length}${visibleReports.length === 50 ? '+' : ''} · ${reportStateLabel(reportFilter, locale)}`;
  return <section aria-label={copy('Tổng quan', 'Overview')} className={styles.overview}>
    <div className={styles.grid}>
      {canReadReports ? <section aria-label={copy('Báo cáo đã tải', 'Loaded reports')} className="admin-overview-section">
        <button type="button" className={styles.queueLink} onClick={onReports} aria-label={copy('Xem báo cáo', 'View reports')} aria-describedby={reportSummaryId}>
          <ReportQueueArtwork pending={(pending && visibleReports.length > 0) || Boolean(reportsLoading || reportsError)} />
          <span className={styles.queueCaption}>
            <strong>{copy('Báo cáo', 'Reports')}</strong>
            <span id={reportSummaryId} aria-live="polite">{reportStatus}</span>
            <time dateTime={reportDay}>{reportDay} · UTC</time>
          </span>
          <ArrowUpRight size={19} aria-hidden="true" className={styles.queueArrow} />
        </button>
        {reportsError ? <p role="alert" className="px-2 pt-3 text-sm">{reportsError}</p> : reportsLoading ? <Skeleton className="mt-3 h-24 w-full" /> : visibleReports.length ? <div className="admin-overview-queue">{visibleReports.slice(0, 3).map(report => <button key={report.reportId} type="button" className="admin-overview-report" onClick={() => onReport(report)}>
          <ReportTargetIcon type={report.targetType} /><span className="min-w-0"><strong className="block text-sm font-semibold">{reportReasonLabel(report.reasonCode, locale)}</strong><span className="mt-1 block line-clamp-1 break-words text-sm text-muted-foreground">{report.description || reportTargetLabel(report.targetType, locale)}</span></span><ArrowRight size={15} aria-hidden="true" />
        </button>)}</div> : null}
      </section> : null}
      {canReadRooms ? <section aria-label={copy('Phòng đã tải', 'Loaded rooms')} className="admin-overview-section">
        <header className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{copy('Phòng', 'Rooms')}</h2><time dateTime={month} className="text-xs text-muted-foreground">{month} · UTC</time></div><Button type="button" variant="ghost" size="sm" onClick={onRooms}>{copy('Xem phòng', 'View rooms')}<ArrowRight size={15} aria-hidden="true" /></Button></header>
        {roomsError ? <div className="admin-directory-empty"><p role="alert">{roomsError}</p><Button type="button" variant="outline" size="sm" onClick={onRetryRooms}>{copy('Tải lại phòng', 'Reload rooms')}</Button></div>
          : roomsLoading ? <Skeleton className="h-72 w-full" /> : rooms.length ? <AdminRoomGallery rooms={rooms} onRoom={onRoom} />
            : <div className="admin-directory-empty"><AdminDirectoryArt kind="room" /><p>{copy('Tháng này chưa có phòng.', 'No rooms this month.')}</p></div>}
      </section> : null}
    </div>
    <div className={styles.health}>
      <Server size={16} aria-hidden="true" /><span>Cassandra</span>
      <span className="flex items-center gap-1.5 text-foreground">{up ? <Check size={15} aria-hidden="true" /> : <CircleAlert size={15} aria-hidden="true" />}{up ? copy('Đang kết nối', 'Connected') : health ? copy('Cần kiểm tra', 'Needs attention') : copy('Chưa đọc được', 'Unavailable')}</span>
    </div>
  </section>;
}
