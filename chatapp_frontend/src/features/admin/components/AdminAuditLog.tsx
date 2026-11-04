import { Check, ChevronDown, Download, HelpCircle, X } from 'lucide-react';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { Button, Input, LoadingSpinner } from '@/shared/ui';
import type { AdminAuditEvent } from '../api/admin.api';
import { AdminToolSection } from './AdminToolSection';
import styles from './AdminAuditLog.module.css';

const AUDIT_ACTION_LABELS: Record<string, string> = {
  FRIEND_REQUEST_SEND: "Gửi lời mời kết bạn",
  FRIEND_REQUEST_CANCEL: "Hủy lời mời kết bạn",
  FRIEND_REQUEST_ACCEPT: "Chấp nhận lời mời kết bạn",
  FRIEND_REQUEST_DECLINE: "Từ chối lời mời kết bạn",
  FRIEND_BLOCK: "Chặn bạn bè",
  FRIEND_UNBLOCK: "Bỏ chặn bạn bè",
  FRIEND_REMOVE: "Xóa bạn bè",
  USER_PROFILE_UPDATE: "Cập nhật hồ sơ",
  USER_ACCOUNT_STATUS_UPDATE: "Cập nhật trạng thái tài khoản",
  USER_SESSION_REVOKED: "Thu hồi phiên đăng nhập",
  USER_DEVICE_REVOKED: "Thu hồi thiết bị",
  APP_ROLE_GRANTED: "Cấp vai trò ứng dụng",
  APP_ROLE_REVOKED: "Thu hồi vai trò ứng dụng",
  ADMIN_MESSAGE_VIEW: "Xem tin nhắn điều tra",
  ADMIN_CONVERSATION_CHAT_POLICY_UPDATE: "Cập nhật chính sách trò chuyện toàn cục",
  ADMIN_CONVERSATION_ARCHIVE: "Lưu trữ phòng",
  ADMIN_CONVERSATION_RESTORE: "Khôi phục phòng",
  CONVERSATION_CREATE: "Tạo phòng",
  MEMBER_ADD: "Thêm thành viên",
  MEMBER_REMOVE: "Xóa thành viên",
  MEMBER_BAN: "Cấm thành viên",
  MEMBER_UNBAN: "Bỏ cấm thành viên",
  COMMUNITY_JOIN: "Tham gia cộng đồng",
  COMMUNITY_JOIN_REQUEST: "Yêu cầu tham gia cộng đồng",
  MEMBER_LEFT: "Rời phòng",
  CONVERSATION_PIN: "Ghim phòng",
  CONVERSATION_UNPIN: "Bỏ ghim phòng",
  CONVERSATION_CHAT_POLICY_UPDATE: "Cập nhật chính sách trò chuyện",
  CONVERSATION_NOTIFICATION_POLICY_UPDATE: "Cập nhật chính sách thông báo phòng",
  MEMBER_NOTIFICATION_POLICY_UPDATE: "Cập nhật chính sách thông báo thành viên",
  MEMBER_CHAT_POLICY_UPDATE: "Cập nhật chính sách trò chuyện thành viên",
  MESSAGE_SEND: "Gửi tin nhắn",
  MESSAGE_EDIT: "Chỉnh sửa tin nhắn",
  MESSAGE_DELETE: "Xóa tin nhắn",
  MESSAGE_REACTION_ADD: "Thêm cảm xúc tin nhắn",
  MESSAGE_REACTION_REMOVE: "Xóa cảm xúc tin nhắn",
  MESSAGE_PIN: "Ghim tin nhắn",
  MESSAGE_UNPIN: "Bỏ ghim tin nhắn",
  POLL_CREATE: "Tạo bình chọn",
  POLL_VOTE: "Bình chọn",
  POLL_VOTE_CHANGE: "Đổi lựa chọn bình chọn",
  POLL_VOTE_REMOVE: "Gỡ bình chọn",
  POLL_CLOSE: "Đóng bình chọn",
  INVITE_CREATE: "Tạo lời mời",
  JOIN_REQUEST_CREATE: "Tạo yêu cầu tham gia",
  JOIN_BY_INVITE: "Tham gia bằng lời mời",
  INVITE_REVOKE: "Thu hồi lời mời",
  INVITE_DECLINE: "Từ chối lời mời",
  JOIN_REQUEST_APPROVE: "Duyệt yêu cầu tham gia",
  JOIN_REQUEST_DECLINE: "Từ chối yêu cầu tham gia",
  ROLE_CREATED: "Tạo vai trò phòng",
  ROLE_DELETED: "Xóa vai trò phòng",
  ROLES_ASSIGNED: "Gán vai trò phòng",
  OWNERSHIP_TRANSFERRED: "Chuyển quyền sở hữu phòng",
  REPORT_CREATED: "Tạo báo cáo",
  REPORT_STATUS_UPDATE: "Cập nhật trạng thái báo cáo",
  SANCTION_IMPOSED: "Áp dụng chế tài",
  SANCTION_REVOKED: "Thu hồi chế tài",
  SANCTION_EXPIRED: "Chế tài hết hạn",
  SYSTEM_SETTING_UPDATED: "Cập nhật cài đặt ứng dụng",
  STICKER_PACK_CREATED: "Tạo bộ sticker",
  STICKER_PACK_UPDATED: "Cập nhật bộ sticker",
  STICKER_CREATED: "Tạo sticker",
  STICKER_UPDATED: "Cập nhật sticker",
};

const auditActionLabel = (action: string): string => {
  return Object.hasOwn(AUDIT_ACTION_LABELS, action) ? localizeText(AUDIT_ACTION_LABELS[action]) : action;
};

const auditOutcomes = {
  SUCCESS: { Icon: Check, label: 'Thành công' },
  FAILED: { Icon: X, label: 'Thất bại' },
  UNKNOWN: { Icon: HelpCircle, label: 'Không xác định' },
};

interface AdminAuditLogProps {
  open: boolean;
  month: string;
  events: AdminAuditEvent[];
  loading: boolean;
  error: string | null;
  exporting: boolean;
  exportError: string | null;
  onMonthChange: (month: string) => void;
  onRetry: () => void;
  onExport: () => void;
}

export function AdminAuditLog({ open, month, events, loading, error, exporting, exportError, onMonthChange, onRetry, onExport }: AdminAuditLogProps) {
  const { locale } = useAppLocale();

  return (
    <AdminToolSection kind="audit" title={localizeText('Nhật ký kiểm toán toàn ứng dụng')} open={open}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 grow basis-40 sm:max-w-52">
          <label htmlFor="admin-audit-month" className="block text-xs font-semibold text-muted-foreground">
            {localizeText('Tháng kiểm toán (UTC)')}
          </label>
          <Input id="admin-audit-month" className="mt-1" type="month" value={month} onChange={event => {
            if (event.target.value) onMonthChange(event.target.value);
          }} />
        </div>
        <Button variant="outline" onClick={onExport} loading={exporting}>
          <Download size={16} aria-hidden="true" />{locale === 'vi' ? 'Xuất CSV' : 'Export CSV'}
        </Button>
      </div>
      {exportError ? <p role="alert" className="mt-2 text-sm text-destructive">{exportError}</p> : null}
      {loading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : error ? (
        <div role="alert" className="space-y-3 py-6 text-sm">
          <p>{error}</p>
          <Button type="button" variant="outline" onClick={onRetry}>{localizeText('Thử lại')}</Button>
        </div>
      ) : events.length ? (
        <AuditTimeline events={events} locale={locale} />
      ) : (
        <div className={styles.empty} role="status">
          <svg viewBox="0 0 132 86" aria-hidden="true" fill="none">
            <path className={styles.emptyField} d="M12 52C5 32 27 9 61 8c39-1 68 16 61 41-6 24-29 31-54 31C43 80 20 73 12 52Z" />
            <path className={styles.emptyPaper} d="m37 18 43 7-9 49-43-7z" />
            <path className={styles.emptyPaper} d="m48 23 39-6 8 48-39 6z" />
            <path d="m61 37 18-3m-16 11 11-2" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            <circle className={styles.emptyPaper} cx="90" cy="59" r="12" />
            <path d="m86 59 3 3 5-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            <path d="M17 31v8m-4-4h8m92 15v6m-3-3h6" stroke="currentColor" strokeLinecap="round" />
          </svg>
          <p>{localizeText('Chưa có sự kiện kiểm toán trong tháng này.')}</p>
        </div>
      )}
    </AdminToolSection>
  );
}

function AuditTimeline({ events, locale }: { events: AdminAuditEvent[]; locale: string }) {
  const date = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });

  return (
    <div className="mt-4">
      {events.length >= 50 ? <p className="mb-2 text-xs text-muted-foreground">
        {localizeText('Hiển thị tối đa 50 sự kiện trong tháng.')}
      </p> : null}
      <ul role="list" className={styles.timeline} aria-live="polite">
        {events.map(event => <AuditEventRow key={event.eventId} event={event} date={date} />)}
      </ul>
    </div>
  );
}

function AuditEventRow({ event, date }: { event: AdminAuditEvent; date: Intl.DateTimeFormat }) {
  const outcome = event.outcome === 'SUCCESS' || event.outcome === 'FAILED' ? event.outcome : 'UNKNOWN';
  const { Icon, label } = auditOutcomes[outcome];
  const createdAt = new Date(event.createdAt);
  return (
    <li>
      <details className={styles.event}>
        <summary className={`focus-ring ${styles.summary}`}>
          <span className={styles.marker} data-outcome={outcome}>
            <Icon size={15} aria-hidden="true" />
            <span className="sr-only">{localizeText(label)}</span>
          </span>
          <span className={styles.caption}>
            <span>{auditActionLabel(event.action)}</span>
            {Number.isFinite(createdAt.getTime()) ? (
              <time dateTime={event.createdAt}>{date.format(createdAt)} UTC</time>
            ) : (
              <span className={styles.date}>{localizeText('Không xác định')}</span>
            )}
          </span>
          <ChevronDown size={16} className={styles.chevron} aria-hidden="true" />
        </summary>
        <div className={styles.details}>
          <p>{event.resourceType}: {event.resourceId}</p>
          {event.actorId ? <p>{localizeText('Người thao tác:')} {event.actorId}</p> : null}
          {event.reasonCode ? <p>{localizeText('Lý do:')} {event.reasonCode}</p> : null}
        </div>
      </details>
    </li>
  );
}
