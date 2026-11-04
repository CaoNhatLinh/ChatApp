import type { NotificationRecord } from '../api/notifications.api';

// Translate structured events, never infer message types from user-authored text.
export function getNotificationCopy(
  notification: Pick<NotificationRecord, 'type' | 'title' | 'body' | 'metadata'>,
  locale: 'vi' | 'en',
): { title: string; body: string } {
  if ((notification.type === 'MESSAGE' || notification.type === 'MENTION')
    && notification.body.length > 0) {
    if (notification.metadata?.messageType === 'STICKER') {
      return { title: notification.title, body: locale === 'en' ? 'Sent a sticker.' : 'Đã gửi sticker.' };
    }
    if (notification.metadata?.messageType === 'GIF') {
      return { title: notification.title, body: locale === 'en' ? 'Sent a GIF.' : 'Đã gửi GIF.' };
    }
  }
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
