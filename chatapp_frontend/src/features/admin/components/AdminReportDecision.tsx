import type { RefObject } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { AdminReport } from '../api/admin.api';
import type { ReportDecisionDraft } from '../model/report-decision';
import { decisionError } from '../model/report-decision';
import { reportReasonLabel, reportStateLabel } from './report-labels';
import { useAppLocale } from '@/shared/i18n';
import { Button, Input, ModalShell, Textarea } from '@/shared/ui';

export interface ReportDecisionProblem { message: string; blocked: boolean }
export type ReportDecisionCheck = { state: 'checking' }
  | { state: 'failed'; message: string }
  | { state: 'verified'; report: AdminReport };

export function AdminReportDecision({ draft, open, busy, current, problem, check, triggerRef, onClose, onChange, onSubmit, onReload, onCheck, onOpenQueue, onDiscard }: {
  draft: ReportDecisionDraft | null; open: boolean; busy: boolean; current: boolean; problem: ReportDecisionProblem | null;
  check: ReportDecisionCheck | null;
  triggerRef: RefObject<HTMLElement | null>; onClose: () => void;
  onChange: (draft: ReportDecisionDraft) => void; onSubmit: () => void; onReload: () => void; onCheck: () => void;
  onOpenQueue: (report: AdminReport) => void; onDiscard: () => void;
}) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  if (!draft) return null;
  const terminal = draft.nextStatus !== 'IN_REVIEW';
  const title = copy('Xác nhận cập nhật báo cáo', 'Confirm report update');
  const action = draft.nextStatus === 'RESOLVED' ? copy('Giải quyết báo cáo', 'Resolve report')
    : draft.nextStatus === 'DISMISSED' ? copy('Bỏ qua báo cáo', 'Dismiss report') : copy('Nhận xử lý báo cáo', 'Take report review');
  const disabled = busy || Boolean(problem?.blocked);
  return <ModalShell open={open} onClose={onClose} title={title} description={copy('Quyết định này chỉ đổi trạng thái báo cáo, không khóa tài khoản.', 'This decision changes the report only; it does not suspend an account.')}
    closeDisabled={busy} showClose={!busy} returnFocusRef={triggerRef} className="admin-report-dialog block overflow-y-auto p-5">
    <header className="pr-10"><ShieldCheck size={24} aria-hidden="true" className="mb-3 text-primary" /><h2 className="text-lg font-semibold">{action}</h2>
      <p className="mt-2 break-words text-sm text-muted-foreground">{reportReasonLabel(draft.report.reasonCode, locale)} · {draft.report.reportId.slice(-8)}</p></header>
    <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
      <div><label htmlFor="admin-report-decision-reason" className="mb-2 block text-sm font-medium">{copy('Lý do quyết định', 'Decision reason')}</label>
        <Textarea id="admin-report-decision-reason" required maxLength={500} value={draft.reason} disabled={disabled} rows={3}
          onChange={event => onChange({ ...draft, reason: event.target.value })} />
        <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">{draft.reason.length}/500</p></div>
      {terminal ? <div><label htmlFor="admin-report-decision-code" className="mb-2 block text-sm font-medium">{copy('Mã kết quả', 'Resolution code')}</label>
        <Input id="admin-report-decision-code" required value={draft.resolutionCode} disabled={disabled} onChange={event => onChange({ ...draft, resolutionCode: event.target.value })} /></div> : null}
      {!current || problem ? <div className="space-y-2 text-sm">
        <p role="alert">{problem?.message || copy('Báo cáo không còn trong kết quả hiện tại.', 'This report is no longer in the current results.')}</p>
        {problem?.blocked ? <Button type="button" variant="outline" size="sm" disabled={busy || check?.state === 'checking'} loading={check?.state === 'checking'} onClick={onCheck}>{copy('Kiểm tra trạng thái', 'Check status')}</Button>
          : <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onReload}>{copy('Tải lại danh sách gốc', 'Reload original queue')}</Button>}
        {check?.state === 'failed' ? <p role="status">{check.message}</p> : null}
        {check?.state === 'verified' ? <div className="space-y-2">
          <p role="status">{copy('Trạng thái hiện tại', 'Current status')}: <strong>{reportStateLabel(check.report.status, locale)}</strong></p>
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenQueue(check.report)}>{copy('Mở hàng đợi hiện tại', 'Open current queue')}</Button>
        </div> : null}
      </div> : null}
      <footer className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" disabled={busy} onClick={onDiscard}>{copy('Bỏ bản nháp', 'Discard draft')}</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{copy('Để sau', 'Keep for later')}</Button>
        <Button type="submit" variant={draft.nextStatus === 'DISMISSED' ? 'destructive' : 'default'} loading={busy}
          disabled={disabled || !current || Boolean(decisionError(draft))}>{copy('Xác nhận', 'Confirm')}</Button>
      </footer>
    </form>
  </ModalShell>;
}
