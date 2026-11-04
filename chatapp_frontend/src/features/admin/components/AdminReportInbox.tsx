import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ChevronRight, Inbox, Search, ShieldCheck } from 'lucide-react';
import { getAdminReport, type AdminReport } from '../api/admin.api';
import type { ReportDecisionDraft, ReportDecisionStatus } from '../model/report-decision';
import { decisionError, filterAdminReports, hasReportDraft, reportIdentity, reportMatchesDraft } from '../model/report-decision';
import { AdminReportDetail, ReportTargetIcon } from './AdminReportDetail';
import { AdminReportDecision } from './AdminReportDecision';
import type { ReportDecisionCheck, ReportDecisionProblem } from './AdminReportDecision';
import { reportReasonLabel, reportStateLabel, reportTargetLabel } from './report-labels';
import { useAppLocale } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { getSessionGeneration } from '@/shared/auth/access-token';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { Button, ConfirmDialog, Input, Select, Skeleton } from '@/shared/ui';

export interface ReportExitState { draft: boolean; busy: boolean }
const REPORT_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'] as const;
interface AdminReportInboxProps {
  reports: AdminReport[]; loading: boolean; error: string | null; day: string; status: AdminReport['status'];
  onDay: (value: string) => void; onStatus: (value: AdminReport['status']) => void; onReload: () => void;
  onResolve: (draft: ReportDecisionDraft) => Promise<AdminReport>;
  onTarget: (userId: string) => void; onExitState: (state: ReportExitState) => void;
  openRequest?: { identity: string };
}

export function AdminReportInbox(props: AdminReportInboxProps) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { if (props.openRequest) setSelected(props.openRequest.identity); }, [props.openRequest]);
  const [draft, setDraft] = useState<ReportDecisionDraft | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const checkRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; checkRequest.current?.abort(); };
  }, []);
  const [problem, setProblem] = useState<ReportDecisionProblem | null>(null);
  const [check, setCheck] = useState<ReportDecisionCheck | null>(null);
  const [pendingReplacement, setPendingReplacement] = useState<{ next: ReportDecisionDraft | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const dirty = hasReportDraft(draft);
  const { onExitState } = props;
  useEffect(() => { onExitState({ draft: dirty, busy }); }, [dirty, busy, onExitState]);
  useEffect(() => () => onExitState({ draft: false, busy: false }), [onExitState]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  const selectedReport = !props.loading && !props.error ? props.reports.find(report => reportIdentity(report) === selected) : undefined;
  const selectedKey = selectedReport ? reportIdentity(selectedReport) : null;
  useEffect(() => { if (selectedKey) titleRef.current?.focus(); }, [selectedKey]);
  const currentDraft = Boolean(draft && !props.loading && !props.error && reportMatchesDraft(props.reports, draft));
  const visible = filterAdminReports(props.reports, query, report => `${reportReasonLabel(report.reasonCode, locale)} ${reportTargetLabel(report.targetType, locale)}`);

  const closeDecision = () => {
    if (checkRequest.current) {
      checkRequest.current.abort();
      checkRequest.current = null;
      setCheck(null);
    }
    setOpen(false);
  };
  const replaceDraft = (next: ReportDecisionDraft | null) => {
    if (busyRef.current) return;
    closeDecision();
    if (dirty) { setPendingReplacement({ next }); return; }
    setDraft(next); setProblem(null); setCheck(null); setOpen(Boolean(next));
  };
  const startDecision = (report: AdminReport, nextStatus: ReportDecisionStatus, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    if (draft && reportIdentity(report) === reportIdentity(draft.report) && nextStatus === draft.nextStatus) { setOpen(true); return; }
    replaceDraft({ report: { ...report }, nextStatus, reason: '', resolutionCode: '' });
  };
  const submit = async () => {
    if (busyRef.current || !draft || decisionError(draft) || !currentDraft || problem?.blocked) return;
    busyRef.current = true; setBusy(true); setProblem(null); setCheck(null); setNotice(null);
    try {
      const updated = await props.onResolve({ ...draft });
      if (!mounted.current) return;
      if (updated.status !== draft.nextStatus || reportIdentity(updated) !== reportIdentity(draft.report)) throw new Error('Unexpected report result');
      setNotice(copy('Đã cập nhật báo cáo.', 'Report updated.'));
      setSelected(null); setDraft(null); setOpen(false);
      requestAnimationFrame(() => searchRef.current?.focus());
    } catch (error: unknown) {
      if (!mounted.current) return;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const blocked = !status || status >= 500 || status === 404 || status === 409;
      setProblem({ blocked, message: blocked
        ? copy('Chưa xác nhận được kết quả. Bản nháp vẫn được giữ.', 'The result is unconfirmed. Your draft is still here.')
        : getUserFacingErrorMessage(error, copy('Không thể cập nhật báo cáo.', 'Could not update the report.')) });
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };
  const checkCurrentReport = async () => {
    if (!draft || !problem?.blocked || busyRef.current || checkRequest.current) return;
    const actorId = useAuthStore.getState().user?.userId;
    if (!actorId) return;
    const controller = new AbortController();
    const generation = getSessionGeneration();
    const isCurrent = () => !controller.signal.aborted && mounted.current && generation === getSessionGeneration()
      && useAuthStore.getState().user?.userId === actorId;
    checkRequest.current = controller;
    setCheck({ state: 'checking' });
    try {
      const report = await getAdminReport(draft.report, controller.signal);
      if (!isCurrent()) return;
      if (reportIdentity(report) !== reportIdentity(draft.report) || report.reporterId !== draft.report.reporterId
        || !REPORT_STATUSES.includes(report.status)) throw new Error('Unexpected report status result');
      setCheck({ state: 'verified', report });
    } catch (error: unknown) {
      if (!isCurrent()) return;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const message = status === 404 ? copy('Không tìm thấy báo cáo này.', 'This report could not be found.')
        : status === 403 ? copy('Bạn không có quyền kiểm tra báo cáo này.', 'You do not have permission to check this report.')
          : copy('Chưa kiểm tra được trạng thái. Hãy thử lại.', 'Could not check the status. Try again.');
      setCheck({ state: 'failed', message });
    } finally {
      if (checkRequest.current === controller) {
        checkRequest.current = null;
        if (mounted.current && !isCurrent()) setCheck(null);
      }
    }
  };
  const openQueue = (report: AdminReport) => {
    triggerRef.current = searchRef.current;
    closeDecision();
    setSelected(reportIdentity(report));
    props.onDay(report.reportDay);
    props.onStatus(report.status);
    props.onReload();
  };
  return <section aria-label={copy('Hộp báo cáo', 'Report inbox')}>
    <h2 className="sr-only">{copy('Hộp báo cáo', 'Report inbox')}</h2>
    {dirty && !open ? <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary p-3 text-sm"><span>{copy('Có quyết định đang soạn.', 'A decision draft is saved here.')}</span>
      <Button ref={resumeRef} type="button" variant="outline" size="sm" onClick={() => { triggerRef.current = resumeRef.current; setOpen(true); }}>{copy('Tiếp tục', 'Resume')}</Button></div> : null}
    {notice ? <p role="status" className="mb-4 flex items-center gap-2 text-sm"><ShieldCheck size={17} aria-hidden="true" />{notice}</p> : null}
    <div className="admin-report-workbench" data-detail={Boolean(selectedReport)}>
      <div className="admin-report-list">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><label htmlFor="admin-report-day" className="mb-2 block text-xs text-muted-foreground">{copy('Ngày báo cáo (UTC)', 'Report day (UTC)')}</label><Input id="admin-report-day" type="date" value={props.day} disabled={busy} onChange={event => { if (event.target.value) props.onDay(event.target.value); }} /></div>
          <div><label htmlFor="admin-report-status" className="mb-2 block text-xs text-muted-foreground">{copy('Trạng thái', 'Status')}</label><Select id="admin-report-status" value={props.status} disabled={busy} onChange={event => props.onStatus(event.target.value as AdminReport['status'])}>
            {REPORT_STATUSES.map(status => <option key={status} value={status}>{reportStateLabel(status, locale)}</option>)}</Select></div></div>
        <div className="relative mt-4"><Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground" /><Input ref={searchRef} type="search" className="pl-9" value={query} placeholder={copy('Tìm báo cáo đã tải', 'Search loaded reports')} aria-label={copy('Tìm trong báo cáo đã tải', 'Search loaded reports')} onChange={event => setQuery(event.target.value)} /></div>
        <div className="my-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{copy('Tối đa 50 báo cáo đã tải', 'Up to 50 loaded reports')}</p><Button type="button" variant="ghost" size="sm" disabled={busy || props.loading} onClick={props.onReload}>{copy('Tải lại', 'Reload')}</Button></div>
        {props.error ? <div role="alert" className="py-6 text-sm"><p>{props.error}</p><Button type="button" variant="outline" className="mt-3" onClick={props.onReload}>{copy('Thử lại', 'Retry')}</Button></div>
          : props.loading ? <div role="status" aria-label={copy('Đang tải báo cáo', 'Loading reports')} className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
            : visible.length ? <div className="admin-report-results">{visible.map(report => <button key={reportIdentity(report)} type="button" className="admin-report-entry" aria-pressed={selected === reportIdentity(report)} disabled={busy} onClick={() => { setSelected(reportIdentity(report)); setNotice(null); }}>
              <ReportTargetIcon type={report.targetType} /><span className="min-w-0"><strong className="block truncate text-sm font-semibold">{reportReasonLabel(report.reasonCode, locale)}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{report.description || reportTargetLabel(report.targetType, locale)}</span></span><ChevronRight size={16} aria-hidden="true" />
            </button>)}</div> : <div role="status" className="admin-directory-empty"><Inbox size={30} aria-hidden="true" /><p>{copy('Không có báo cáo nào khớp bộ lọc hiện tại.', 'No reports match the current filter.')}</p>{query ? <Button type="button" variant="ghost" onClick={() => setQuery('')}>{copy('Xóa tìm kiếm', 'Clear search')}</Button> : null}</div>}
      </div>
      <div className="admin-report-detail">{selectedReport ? <AdminReportDetail report={selectedReport} titleRef={titleRef} busy={busy} onDecision={startDecision} onTarget={props.onTarget}
        onBack={() => { setSelected(null); requestAnimationFrame(() => searchRef.current?.focus()); }} /> : <div className="admin-directory-placeholder"><ShieldCheck size={48} aria-hidden="true" className="text-muted-foreground" /><p className="text-sm text-muted-foreground">{copy('Chọn một báo cáo để xem.', 'Choose a report to inspect.')}</p></div>}</div>
    </div>
    <AdminReportDecision draft={draft} open={open} busy={busy} current={currentDraft} problem={problem} check={check} triggerRef={triggerRef}
      onClose={closeDecision} onChange={setDraft} onSubmit={() => void submit()} onCheck={() => void checkCurrentReport()} onOpenQueue={openQueue}
      onDiscard={() => replaceDraft(null)} onReload={() => { if (draft) { props.onDay(draft.report.reportDay); props.onStatus(draft.report.status); props.onReload(); } }} />
    <ConfirmDialog open={Boolean(pendingReplacement)} title={copy('Bỏ quyết định đang soạn?', 'Discard the current decision draft?')} description={copy('Thao tác này không gửi quyết định. Nội dung đang soạn sẽ bị bỏ.', 'No decision will be submitted. The current draft will be discarded.')} confirmLabel={copy('Bỏ bản nháp', 'Discard draft')} destructive
      onOpenChange={next => { if (!next) { setPendingReplacement(null); setOpen(Boolean(draft)); } }}
      onConfirm={() => { const next = pendingReplacement?.next ?? null; setPendingReplacement(null); setDraft(next); setProblem(null); setCheck(null); setOpen(Boolean(next)); }} />
  </section>;
}
