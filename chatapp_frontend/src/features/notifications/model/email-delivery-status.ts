import type { EmailHistoryStatus } from '../api/notifications.api';

export const emailDeliveryStatusLabels: Record<EmailHistoryStatus, readonly [string, string]> = {
  PENDING: ['Đang chờ gửi', 'Waiting to send'],
  SENDING: ['Đang gửi', 'Sending'],
  RETRY: ['Đang chờ gửi lại', 'Waiting to retry'],
  SENT: ['Đã chuyển cho dịch vụ email', 'Handed to email provider'],
  DELAYED: ['Giao chậm', 'Delivery delayed'],
  DELIVERED: ['Đã giao', 'Delivered'],
  FAILED: ['Gửi thất bại', 'Sending failed'],
  BOUNCED: ['Email bị trả lại', 'Bounced'],
  COMPLAINED: ['Có báo cáo thư rác', 'Reported as spam'],
  SUPPRESSED: ['Đã chặn gửi', 'Delivery suppressed'],
  SKIPPED: ['Đã bỏ qua', 'Skipped'],
  REVIEW_REQUIRED: ['Cần kiểm tra', 'Needs review'],
  UNKNOWN: ['Chưa rõ trạng thái', 'Unknown status'],
};
