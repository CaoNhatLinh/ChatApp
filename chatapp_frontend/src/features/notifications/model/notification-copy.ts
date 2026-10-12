import type { NotificationRecord } from '../api/notifications.api';

// Only structured system decisions are translated. User-authored content stays intact.
export function getNotificationCopy(
  notification: Pick<NotificationRecord, 'type' | 'title' | 'body'>,
  locale: 'vi' | 'en',
): { title: string; body: string } {
  if (notification.type === 'JOIN_REQUEST_APPROVED') {
    return locale === 'en'
      ? { title: 'Your join request was approved', body: 'You can now open the room and join the conversation.' }
      : { title: 'Bạn đã được duyệt vào phòng', body: 'Mở phòng để bắt đầu trò chuyện nhé.' };
  }
  if (notification.type === 'JOIN_REQUEST_DECLINED') {
    return locale === 'en'
      ? { title: 'Your join request was declined', body: 'The room did not accept your request this time.' }
      : { title: 'Yêu cầu vào phòng chưa được chấp nhận', body: 'Phòng đã từ chối yêu cầu tham gia lần này.' };
  }
  return { title: notification.title, body: notification.body };
}
