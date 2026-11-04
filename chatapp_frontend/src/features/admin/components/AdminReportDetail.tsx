import { ArrowLeft, ChevronDown, MessageCircle, UserRound, UsersRound } from 'lucide-react';
import type { RefObject } from 'react';
import type { AdminReport } from '../api/admin.api';
import type { ReportDecisionStatus } from '../model/report-decision';
import { reportReasonLabel, reportStateLabel, reportTargetLabel } from './report-labels';
import { useAppLocale } from '@/shared/i18n';
import { Badge, Button } from '@/shared/ui';

export function ReportTargetIcon({ type }: { type: string }) {
  const Icon = type === 'USER' ? UserRound : type === 'CONVERSATION' ? UsersRound : MessageCircle;
  return <span className="admin-report-symbol" aria-hidden="true"><Icon size={22} /></span>;
}

export function AdminReportDetail({ report, titleRef, busy, onBack, onDecision, onTarget }: {
  report: AdminReport; titleRef: RefObject<HTMLHeadingElement | null>; busy: boolean;
  onBack: () => void; onDecision: (report: AdminReport, next: ReportDecisionStatus, trigger: HTMLButtonElement) => void;
  onTarget: (userId: string) => void;
}) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const actionable = report.status === 'OPEN' || report.status === 'IN_REVIEW';
  const targetUserId = report.targetUserId;
  const decide = (next: ReportDecisionStatus, trigger: HTMLButtonElement) => onDecision(report, next, trigger);
  return <>
    <Button type="button" variant="ghost" size="sm" className="mb-4 lg:hidden" disabled={busy} onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />{copy('Danh sách báo cáo', 'Report list')}</Button>
    <header className="flex items-start gap-4"><ReportTargetIcon type={report.targetType} /><div className="min-w-0">
      <h3 ref={titleRef} tabIndex={-1} className="break-words text-xl font-semibold outline-none">{reportReasonLabel(report.reasonCode, locale)}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="outline">{reportStateLabel(report.status, locale)}</Badge><span className="text-xs text-muted-foreground">{reportTargetLabel(report.targetType, locale)}</span></div>
    </div></header>
    <blockquote className="my-6 whitespace-pre-wrap break-words text-base leading-7">{report.description || copy('Người gửi không thêm mô tả.', 'No description was supplied.')}</blockquote>
    <details className="admin-room-disclosure">
      <summary>{copy('Thông tin báo cáo', 'Report information')}<ChevronDown size={16} aria-hidden="true" /></summary>
      <dl className="mt-3 space-y-3 break-all text-sm">
        {[[copy('Mã báo cáo', 'Report ID'), report.reportId], [copy('Người báo cáo', 'Reporter ID'), report.reporterId],
          [copy('Người bị báo cáo', 'Target user ID'), report.targetUserId], [copy('Phòng', 'Conversation ID'), report.conversationId],
          [copy('Tin nhắn', 'Message ID'), report.messageId], ['Bucket', report.messageBucket],
          [copy('Mã lý do', 'Reason code'), report.reasonCode], [copy('Được giao cho', 'Assigned to'), report.assignedTo],
          [copy('Mã kết quả', 'Resolution code'), report.resolutionCode]].filter(([, value]) => Boolean(value)).map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </details>
    <div className="mt-5 flex flex-wrap gap-2">
      {report.status === 'OPEN' ? <Button type="button" variant="outline" disabled={busy} onClick={event => decide('IN_REVIEW', event.currentTarget)}>{copy('Nhận xử lý', 'Take review')}</Button> : null}
      {actionable ? <>
        <Button type="button" disabled={busy} onClick={event => decide('RESOLVED', event.currentTarget)}>{copy('Giải quyết', 'Resolve')}</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={event => decide('DISMISSED', event.currentTarget)}>{copy('Bỏ qua', 'Dismiss')}</Button>
      </> : null}
    </div>
    {targetUserId ? <Button type="button" variant="ghost" size="sm" className="mt-4" disabled={busy} onClick={() => onTarget(targetUserId)}><UserRound size={16} aria-hidden="true" />{copy('Chọn người dùng mục tiêu', 'Select target user')}</Button> : null}
  </>;
}
