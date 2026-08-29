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
import { logger } from '@/shared/lib/logger';
import { localizeText } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';

interface RealtimeHandle {
  isNotificationConnected: boolean;
  id: string;
}

interface NotificationStore {
  notifications: NotificationRecord[];
  unreadCount: number;
  hasNext: boolean;
  page: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  loadMoreError: string | null;
  isPanelOpen: boolean;
  realtimeUserId: string | null;
  initNotifications: () => Promise<void>;
  loadMoreNotifications: () => Promise<void>;
  connectRealtime: (userId: string) => void;
  disconnectRealtime: () => void;
  resetState: () => void;
  setPanelOpen: (open: boolean) => void;
  markOneAsRead: (notificationId: string) => Promise<void>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
  markEverythingAsRead: () => Promise<void>;
  removeNotification: (notificationId: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
}

let notificationRealtimeUnsubscribers: Array<() => void> = [];
let reconnectHandle: RealtimeHandle | null = null;
let notificationInitGeneration = 0;

type NotificationReadEvent =
  | { action: 'MARK_ALL_READ' }
  | { action: 'MARK_READ'; notificationId: string }
  | { action: 'MARK_READ'; notificationIds: string[] };

type NotificationDeleteEvent =
  | { action: 'DELETE_ALL' }
  | { action: 'DELETE'; notificationId: string };

const notificationTypes = new Set<NotificationRecord['type']>([
  'FRIEND_REQUEST', 'MESSAGE', 'SYSTEM', 'MENTION', 'REACTION',
  'CONVERSATION_INVITE', 'POLL', 'PIN_MESSAGE', 'REPLY',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseNotificationEvent = (payload: unknown): NotificationRecord | null => {
  if (!isRecord(payload)
    || typeof payload.notificationId !== 'string'
    || typeof payload.userId !== 'string'
    || typeof payload.type !== 'string'
    || !notificationTypes.has(payload.type as NotificationRecord['type'])
    || typeof payload.title !== 'string'
    || typeof payload.body !== 'string'
    || typeof payload.isRead !== 'boolean'
    || typeof payload.createdAt !== 'string') {
    return null;
  }

  return {
    notificationId: payload.notificationId,
    userId: payload.userId,
    type: payload.type as NotificationRecord['type'],
    title: payload.title,
    body: payload.body,
    isRead: payload.isRead,
    createdAt: payload.createdAt,
    ...(isRecord(payload.metadata) ? { metadata: payload.metadata } : {}),
  };
};

const parseReadEvent = (payload: unknown): NotificationReadEvent | null => {
  if (!isRecord(payload)) return null;
  if (payload.action === 'MARK_ALL_READ') return { action: 'MARK_ALL_READ' };
  if (payload.action !== 'MARK_READ') return null;
  if (typeof payload.notificationId === 'string') {
    return { action: 'MARK_READ', notificationId: payload.notificationId };
  }
  if (Array.isArray(payload.notificationIds) && payload.notificationIds.every((id) => typeof id === 'string')) {
    return { action: 'MARK_READ', notificationIds: payload.notificationIds };
  }
  return null;
};

const parseDeleteEvent = (payload: unknown): NotificationDeleteEvent | null => {
  if (!isRecord(payload)) return null;
  if (payload.action === 'DELETE_ALL') return { action: 'DELETE_ALL' };
  if (payload.action === 'DELETE' && typeof payload.notificationId === 'string') {
    return { action: 'DELETE', notificationId: payload.notificationId };
  }
  return null;
};

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

const disconnectAllNotificationSubscriptions = () => {
  notificationRealtimeUnsubscribers.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {
      logger.warn('Notification realtime unsubscribe failed', error instanceof Error ? error.message : String(error));
    }
  });
  notificationRealtimeUnsubscribers = [];
  reconnectHandle = null;
};

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  hasNext: false,
  page: 0,
  loading: false,
  error: null,
  loadingMore: false,
  loadMoreError: null,
  isPanelOpen: false,
  realtimeUserId: null,

  initNotifications: async () => {
    const generation = ++notificationInitGeneration;
    set({ loading: true, error: null, loadingMore: false, loadMoreError: null, page: 0 });
    try {
      const [page, unreadCount] = await Promise.all([
        getAllNotifications(0, 50),
        getUnreadCount(),
      ]);
      if (generation !== notificationInitGeneration) return;
      set({
        notifications: page.content,
        hasNext: page.hasNext,
        page: 0,
        unreadCount,
        loading: false,
        loadingMore: false,
        loadMoreError: null,
      });
    } catch (error: unknown) {
      if (generation !== notificationInitGeneration) return;
      logger.warn('Notification initialization failed', error instanceof Error ? error.message : String(error));
      set({
        loading: false,
        error: getUserFacingErrorMessage(error, localizeText('Không thể tải thông báo. Vui lòng thử lại.')),
      });
    }
  },

  loadMoreNotifications: async () => {
    const state = get();
    if (state.loading || state.loadingMore || !state.hasNext) return;

    const generation = notificationInitGeneration;
    const nextPage = state.page + 1;
    set({ loadingMore: true, loadMoreError: null });

    try {
      const page = await getAllNotifications(nextPage, 50);
      if (generation !== notificationInitGeneration) return;

      set(current => {
        const existingIds = new Set(current.notifications.map(notification => notification.notificationId));
        const appended = page.content.filter(notification => !existingIds.has(notification.notificationId));
        return {
          notifications: [...current.notifications, ...appended],
          hasNext: page.hasNext,
          page: nextPage,
          loadingMore: false,
          loadMoreError: null,
        };
      });
    } catch (error: unknown) {
      if (generation !== notificationInitGeneration) return;
      logger.warn('Notification pagination failed', error instanceof Error ? error.message : String(error));
      set({
        loadingMore: false,
        loadMoreError: getUserFacingErrorMessage(
          error,
          localizeText('Không thể tải thêm thông báo. Vui lòng thử lại.'),
        ),
      });
    }
  },

  connectRealtime: (userId: string) => {
    if (reconnectHandle?.isNotificationConnected && reconnectHandle.id === userId) {
      return;
    }

    disconnectAllNotificationSubscriptions();

    const unsubNotification = realtimeService.subscribe('/user/queue/notifications', (payload: unknown) => {
      const notification = parseNotificationEvent(payload);
      if (!notification) {
        logger.warn('Ignoring invalid notification event payload');
        return;
      }
      set(state => {
        const previous = state.notifications.find(
          (item) => item.notificationId === notification.notificationId,
        );
        const unreadDelta = (notification.isRead ? 0 : 1) - (previous && !previous.isRead ? 1 : 0);
        return {
          notifications: upsertNotification(state.notifications, notification),
          unreadCount: Math.max(0, state.unreadCount + unreadDelta),
        };
      });
    });

    const unsubRead = realtimeService.subscribe('/user/queue/notification-read', (payload: unknown) => {
      const data = parseReadEvent(payload);
      if (!data) {
        logger.warn('Ignoring invalid notification read event payload');
        return;
      }
      set(state => {
        if (data.action === 'MARK_ALL_READ') {
          return {
            notifications: state.notifications.map(notification => ({ ...notification, isRead: true })),
            unreadCount: 0,
          };
        }

        const ids = new Set<string>('notificationId' in data ? [data.notificationId] : data.notificationIds);

        return {
          notifications: markNotificationsRead(state.notifications, ids),
          unreadCount: Math.max(
            0,
            state.unreadCount - state.notifications.filter(notification => ids.has(notification.notificationId) && !notification.isRead).length
          ),
        };
      });
    });

    const unsubDelete = realtimeService.subscribe('/user/queue/notification-delete', (payload: unknown) => {
      const data = parseDeleteEvent(payload);
      if (!data) {
        logger.warn('Ignoring invalid notification delete event payload');
        return;
      }
      set(state => {
        if (data.action === 'DELETE_ALL') {
          return { notifications: [], unreadCount: 0 };
        }

        const target = state.notifications.find(notification => notification.notificationId === data.notificationId);
        return {
          notifications: state.notifications.filter(notification => notification.notificationId !== data.notificationId),
          unreadCount: target && !target.isRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
        };
      });
    });

    notificationRealtimeUnsubscribers = [unsubNotification, unsubRead, unsubDelete];
    reconnectHandle = { id: userId, isNotificationConnected: true };
    set({ realtimeUserId: userId });
  },

  disconnectRealtime: () => {
    disconnectAllNotificationSubscriptions();
    set({ realtimeUserId: null });
  },

  resetState: () => {
    notificationInitGeneration += 1;
    get().disconnectRealtime();
    set({
      notifications: [],
      unreadCount: 0,
      hasNext: false,
      page: 0,
      loading: false,
      loadingMore: false,
      error: null,
      loadMoreError: null,
      isPanelOpen: false,
    });
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
