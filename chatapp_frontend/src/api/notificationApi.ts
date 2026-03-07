// src/api/notificationApi.ts

import api from '@/lib/axios';

export interface Notification {
  notificationId: string;
  userId: string;
  type: 'FRIEND_REQUEST' | 'MESSAGE' | 'SYSTEM' | 'MENTION' | 'REACTION';
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

/**
 * 📋 Get all notifications for current user
 */
export const getAllNotifications = async (limit: number = 50): Promise<Notification[]> => {
  const response = await api.get<Notification[]>(`/notifications?limit=${limit}`);
  return response.data;
};

/**
 * 🔔 Get unread notifications
 */
export const getUnreadNotifications = async (): Promise<Notification[]> => {
  const response = await api.get<Notification[]>('/notifications/unread');
  return response.data;
};

/**
 * 🔢 Get unread count
 */
export const getUnreadCount = async (): Promise<{ count: number }> => {
  const response = await api.get<{ count: number }>('/notifications/unread/count');
  return response.data;
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
  type: Notification['type'],
  limit: number = 50
): Promise<Notification[]> => {
  const response = await api.get<Notification[]>(`/notifications/type/${type}?limit=${limit}`);
  return response.data;
};

/**
 * 🆕 Get latest notification
 */
export const getLatestNotification = async (): Promise<Notification | null> => {
  const response = await api.get<Notification | null>('/notifications/latest');
  return response.data;
};
