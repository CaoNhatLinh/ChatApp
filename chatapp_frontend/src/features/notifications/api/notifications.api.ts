import api from '@/shared/api/apiClient';

export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'MESSAGE'
  | 'SYSTEM'
  | 'MENTION'
  | 'REACTION'
  | 'CONVERSATION_INVITE'
  | 'POLL'
  | 'PIN_MESSAGE'
  | 'REPLY';

export interface NotificationRecord {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPage {
  content: NotificationRecord[];
  hasNext: boolean;
  hasContent: boolean;
}

export interface NotificationStats {
  userId: string;
  totalCount: number;
  unreadCount: number;
  readCount: number;
  weeklyCount: number;
  typeStats: Record<string, number>;
  lastUpdated: string;
}

export const getNotificationConversationId = (notification: NotificationRecord): string | undefined => {
  const value = notification.metadata?.conversationId;
  return typeof value === 'string' ? value : undefined;
};

export const getNotificationMessageId = (notification: NotificationRecord): string | undefined => {
  const value = notification.metadata?.messageId;
  return typeof value === 'string' ? value : undefined;
};

export const isConversationAttentionNotification = (notification: NotificationRecord): boolean => {
  return ['MESSAGE', 'MENTION', 'REPLY'].includes(notification.type) && Boolean(getNotificationConversationId(notification));
};

/**
 * 📋 Get all notifications for current user
 */
export const getAllNotifications = async (page: number = 0, size: number = 50): Promise<NotificationPage> => {
  const response = await api.get<NotificationPage>('/notifications', { params: { page, size } });
  return response.data;
};

/**
 * 🔔 Get unread notifications
 */
export const getUnreadNotifications = async (): Promise<NotificationRecord[]> => {
  const response = await api.get<NotificationRecord[]>('/notifications/unread');
  return response.data;
};

/**
 * 🔢 Get unread count
 */
export const getUnreadCount = async (): Promise<number> => {
  const response = await api.get<{ count: number }>('/notifications/unread/count');
  return Number(response.data.count ?? 0);
};

/**
 * ✅ Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  await api.put(`/notifications/${notificationId}/read`);
};

/**
 * ✅ Mark all notifications as read
 */
export const markAllAsRead = async (): Promise<void> => {
  await api.put('/notifications/read-all');
};

export const bulkMarkAsRead = async (notificationIds: string[]): Promise<void> => {
  if (notificationIds.length === 0) {
    return;
  }
  await api.put('/notifications/bulk-read', notificationIds);
};

/**
 * 🗑️ Delete notification
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
  await api.delete(`/notifications/${notificationId}`);
};

/**
 * 🗑️ Delete all notifications
 */
export const deleteAllNotifications = async (): Promise<void> => {
  await api.delete('/notifications/all');
};

/**
 * 📊 Get notification statistics
 */
export const getNotificationStats = async (): Promise<NotificationStats> => {
  const response = await api.get<NotificationStats>('/notifications/stats');
  return response.data;
};

/**
 * 📝 Get notifications by type
 */
export const getNotificationsByType = async (
  type: NotificationType,
  page: number = 0,
  size: number = 50
): Promise<NotificationPage> => {
  const response = await api.get<NotificationPage>(`/notifications/type/${type}`, { params: { page, size } });
  return response.data;
};

/**
 * 🆕 Get latest notification
 */
export const getLatestNotification = async (): Promise<NotificationRecord | null> => {
  const response = await api.get<NotificationRecord | null>('/notifications/latest');
  return response.data;
};
