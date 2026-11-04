import type { AdminReport } from '../api/admin.api';

export function reportReasonLabel(code: string, locale: string): string {
  const labels: Record<string, [string, string]> = {
    SPAM: ['Spam hoặc lừa đảo', 'Spam or scams'], HARASSMENT: ['Quấy rối hoặc bắt nạt', 'Harassment or bullying'],
    HATE_SPEECH: ['Ngôn từ thù ghét', 'Hate speech'], SEXUAL_CONTENT: ['Nội dung tình dục', 'Sexual content'],
    VIOLENCE: ['Bạo lực hoặc đe doạ', 'Violence or threats'], OTHER: ['Lý do khác', 'Other'],
  };
  return labels[code]?.[locale === 'vi' ? 0 : 1] ?? code;
}

export function reportStateLabel(status: AdminReport['status'], locale: string): string {
  const labels = { OPEN: ['Chờ xử lý', 'Open'], IN_REVIEW: ['Đang xem xét', 'In review'], RESOLVED: ['Đã giải quyết', 'Resolved'], DISMISSED: ['Đã bỏ qua', 'Dismissed'] };
  return labels[status][locale === 'vi' ? 0 : 1];
}

export function reportTargetLabel(type: string, locale: string): string {
  const labels: Record<string, [string, string]> = { USER: ['Người dùng', 'User'], MESSAGE: ['Tin nhắn', 'Message'], CONVERSATION: ['Cuộc trò chuyện', 'Conversation'] };
  return labels[type]?.[locale === 'vi' ? 0 : 1] ?? type;
}
