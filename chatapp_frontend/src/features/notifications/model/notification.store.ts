import { create } from 'zustand';
import {
  bulkMarkAsRead,
  deleteAllNotifications,
  deleteNotification,
  getAllNotifications,
  getNotificationConversationId,
  getUnreadCount,
  isConversationAttentionNotification,
  markAllAsRead,
  markNotificationAsRead,
  type NotificationRecord,
} from '@/features/notifications/api/notifications.api';
import { realtimeService } from '@/shared/websocket/realtime-service';

export interface NotificationStore {
  notifications: NotificationRecord[];
  unreadCount: number;
  hasNext: boolean;
  loading: boolean;
  isPanelOpen: boolean;
  realtimeUserId: string | null;
  initNotifications: () => Promise<void>;
  connectRealtime: (userId: string) => void;
  setPanelOpen: (open: boolean) => void;
  markOneAsRead: (notificationId: string) => Promise<void>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
  markEverythingAsRead: () => Promise<void>;
  removeNotification: (notificationId: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
}

const upsertNotification = (notifications: NotificationRecord[], notification: NotificationRecord): NotificationRecord[] => {
  const existingIndex = notifications.findIndex(item => item.notificationId === notification.notificationId);
  if (existingIndex === -1) {
    return [notification, ...notifications];
  }

  const next = [...notifications];
  next[existingIndex] = notification;
  return next;
};

const markNotificationsRead = (notifications: NotificationRecord[], notificationIds: Set<string>): NotificationRecord[] => {
  return notifications.map(notification => (
    notificationIds.has(notification.notificationId)
      ? { ...notification, isRead: true }
      : notification
  ));
};

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  hasNext: false,
  loading: false,
  isPanelOpen: false,
  realtimeUserId: null,

  initNotifications: async () => {
    set({ loading: true });
    try {
      const [page, unreadCount] = await Promise.all([
        getAllNotifications(0, 50),
        getUnreadCount(),
      ]);
      set({
        notifications: page.content,
        hasNext: page.hasNext,
        unreadCount,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  connectRealtime: (userId: string) => {
    if (get().realtimeUserId === userId) {
      return;
    }

    realtimeService.subscribe(`/user/${userId}/queue/notifications`, (payload: unknown) => {
      const notification = payload as NotificationRecord;
      set(state => ({
        notifications: upsertNotification(state.notifications, notification),
        unreadCount: state.unreadCount + (notification.isRead ? 0 : 1),
      }));
    });

    realtimeService.subscribe(`/user/${userId}/queue/notification-read`, (payload: unknown) => {
      const data = payload as { notificationId?: string; notificationIds?: string[]; action?: string };
      set(state => {
        if (data.action === 'MARK_ALL_READ') {
          return {
            notifications: state.notifications.map(notification => ({ ...notification, isRead: true })),
            unreadCount: 0,
          };
        }

        const ids = new Set<string>([
          ...(typeof data.notificationId === 'string' ? [data.notificationId] : []),
          ...((data.notificationIds ?? []).filter((id): id is string => typeof id === 'string')),
        ]);

        return ids.size === 0
          ? state
          : {
              notifications: markNotificationsRead(state.notifications, ids),
              unreadCount: Math.max(0, state.notifications.filter(notification => !notification.isRead && ids.has(notification.notificationId)).length ? state.unreadCount - state.notifications.filter(notification => !notification.isRead && ids.has(notification.notificationId)).length : state.unreadCount),
            };
      });
    });

    realtimeService.subscribe(`/user/${userId}/queue/notification-delete`, (payload: unknown) => {
      const data = payload as { notificationId?: string; action?: string };
      set(state => {
        if (data.action === 'DELETE_ALL') {
          return { notifications: [], unreadCount: 0 };
        }

        if (!data.notificationId) {
          return state;
        }

        const target = state.notifications.find(notification => notification.notificationId === data.notificationId);
        return {
          notifications: state.notifications.filter(notification => notification.notificationId !== data.notificationId),
          unreadCount: target && !target.isRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
        };
      });
    });

    set({ realtimeUserId: userId });
  },

  setPanelOpen: (open) => set({ isPanelOpen: open }),

  markOneAsRead: async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    set(state => {
      const target = state.notifications.find(notification => notification.notificationId === notificationId);
      return {
        notifications: state.notifications.map(notification => (
          notification.notificationId === notificationId
            ? { ...notification, isRead: true }
            : notification
        )),
        unreadCount: target && !target.isRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    });
  },

  markConversationAsRead: async (conversationId: string) => {
    const unreadConversationNotifications = get().notifications.filter(notification => {
      return !notification.isRead
        && isConversationAttentionNotification(notification)
        && getNotificationConversationId(notification) === conversationId;
    });

    if (unreadConversationNotifications.length === 0) {
      return;
    }

    const notificationIds = unreadConversationNotifications.map(notification => notification.notificationId);
    await bulkMarkAsRead(notificationIds);

    const readIds = new Set(notificationIds);
    set(state => ({
      notifications: markNotificationsRead(state.notifications, readIds),
      unreadCount: Math.max(0, state.unreadCount - unreadConversationNotifications.length),
    }));
  },

  markEverythingAsRead: async () => {
    await markAllAsRead();
    set(state => ({
      notifications: state.notifications.map(notification => ({ ...notification, isRead: true })),
      unreadCount: 0,
    }));
  },

  removeNotification: async (notificationId: string) => {
    await deleteNotification(notificationId);
    set(state => {
      const target = state.notifications.find(notification => notification.notificationId === notificationId);
      return {
        notifications: state.notifications.filter(notification => notification.notificationId !== notificationId),
        unreadCount: target && !target.isRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    });
  },

  clearNotifications: async () => {
    await deleteAllNotifications();
    set({ notifications: [], unreadCount: 0 });
  },
}));

export const useNotificationState = <T,>(selector: (state: NotificationStore) => T): T => {
  return useNotificationStore(selector);
};

export const getNotificationState = (): NotificationStore => useNotificationStore.getState();