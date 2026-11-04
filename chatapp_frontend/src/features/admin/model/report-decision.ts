import type { AdminReport } from '../api/admin.api';

export type ReportDecisionStatus = 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';
export interface ReportDecisionDraft {
  report: AdminReport;
  nextStatus: ReportDecisionStatus;
  reason: string;
  resolutionCode: string;
}

export function reportIdentity(report: AdminReport): string {
  return `${report.reportDay}/${report.createdAtKey}/${report.reportId}`;
}

export function canDecideReport(report: AdminReport, nextStatus: AdminReport['status']): boolean {
  return (report.status === 'OPEN' || report.status === 'IN_REVIEW')
    && (nextStatus === 'RESOLVED' || nextStatus === 'DISMISSED' || (report.status === 'OPEN' && nextStatus === 'IN_REVIEW'));
}

export function decisionError(draft: ReportDecisionDraft): 'status' | 'reason' | 'resolutionCode' | null {
  if (!canDecideReport(draft.report, draft.nextStatus)) return 'status';
  if (!draft.reason.trim() || draft.reason.trim().length > 500) return 'reason';
  if (draft.nextStatus !== 'IN_REVIEW' && !draft.resolutionCode.trim()) return 'resolutionCode';
  return null;
}

export function hasReportDraft(draft: ReportDecisionDraft | null): boolean {
  return Boolean(draft && (draft.reason.trim() || draft.resolutionCode.trim()));
}

export function reportMatchesDraft(reports: AdminReport[], draft: ReportDecisionDraft): boolean {
  return reports.some(report => reportIdentity(report) === reportIdentity(draft.report) && report.status === draft.report.status);
}

export function filterAdminReports(reports: AdminReport[], query: string, displayText: (report: AdminReport) => string): AdminReport[] {
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase();
  const search = normalize(query.trim());
  return reports.filter(report => normalize(`${displayText(report)} ${report.reasonCode} ${report.description ?? ''} ${report.reportId} ${report.targetUserId ?? ''}`).includes(search));
}
