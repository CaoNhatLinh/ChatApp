import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CreateRoomModal } from '@/features/messenger/components/Modals/CreateRoomModal';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useMessenger } from '@/features/messenger/model/useMessenger';
import { useTrackPresence } from '@/features/presence/hooks/useTrackPresence';
import { realtimeService } from '@/shared/websocket/realtime-service';
import { UserSettingsModal } from '@/features/settings/ui/UserSettingsModal';
import {
  getAllNotifications,
  getNotificationConversationId,
  getUnreadCount,
  markAllAsRead,
  markNotificationAsRead,
  type NotificationRecord,
} from '@/features/notifications/api/notifications.api';
import { SidebarConversationList } from './SidebarConversationList';
import { SidebarFooter } from './SidebarFooter';
import { SidebarHeader } from './SidebarHeader';
import { SidebarNotificationPanel } from './components/SidebarNotificationPanel';
import { SidebarSearchBar } from './SidebarSearchBar';

type SettingsTab = 'profile' | 'appearance';

export const ChatSidebar = () => {
  const {
    conversations,
    selectConversation,
    activeConversationId,
    setActiveView,
    activeView,
    loadMoreConversations,
    conversationsHasNext,
    loading,
    pinConversation,
    unpinConversation,
    friendRequestCount,
  } = useMessenger();

  const { user } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsModalTab, setSettingsModalTab] = useState<SettingsTab>('profile');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const filteredConversations = useMemo(
    () =>
      (conversations || []).filter((conversation) =>
        conversation.name.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [conversations, searchTerm],
  );

  const dmUserIds = useMemo(
    () =>
      filteredConversations
        .filter((conversation) => conversation.type === 'dm' && conversation.otherParticipant)
        .map((conversation) => conversation.otherParticipant?.userId)
        .filter((userId): userId is string => Boolean(userId)),
    [filteredConversations],
  );

  useTrackPresence(dmUserIds);

  const handleOpenSettings = useCallback(
    (tab: SettingsTab = 'profile') => {
      setSettingsModalTab(tab);
      setIsSettingsModalOpen(true);
    },
    [],
  );

  const handleOpenContacts = useCallback(() => {
    setActiveView('contacts');
  }, [setActiveView]);

  const handleSelectConversation = useCallback(
    async (conversationId: string) => {
      await selectConversation(conversationId);
    },
    [selectConversation],
  );

  const toggleNotificationPanel = useCallback(() => {
    setIsNotificationPanelOpen((current) => !current);
  }, []);

  const closeNotificationPanel = useCallback(() => {
    setIsNotificationPanelOpen(false);
  }, []);

  useEffect(() => {
    if (!conversationsHasNext || loading || searchTerm) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        void loadMoreConversations();
      }
    }, { threshold: 0.1 });

    const sentinel = sentinelRef.current;
    if (sentinel) observer.observe(sentinel);

    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [conversationsHasNext, loadMoreConversations, loading, searchTerm]);

  useEffect(() => {
    if (!user?.userId) return;
    let cancelled = false;

    const initializeNotifications = async () => {
      try {
        const [page, unreadCount] = await Promise.all([getAllNotifications(0, 50), getUnreadCount()]);
        if (cancelled) return;
        setNotifications(page.content);
        setNotificationUnreadCount(unreadCount);
      } catch (error) {
        console.error('Failed to load notifications', error);
      }
    };

    void initializeNotifications();

    const unsubscribeNotification = realtimeService.subscribe(`/user/${user.userId}/queue/notifications`, (payload: NotificationRecord) => {
      setNotifications((current) => {
        const index = current.findIndex(notification => notification.notificationId === payload.notificationId);
        if (index === -1) return [payload, ...current];
        const copy = [...current];
        copy[index] = payload;
        return copy;
      });

      if (!payload.isRead) {
        setNotificationUnreadCount((count) => count + 1);
      }
    });

    const unsubscribeRead = realtimeService.subscribe(`/user/${user.userId}/queue/notification-read`, (payload: { notificationId?: string; notificationIds?: string[]; action?: string }) => {
      if (payload.action === 'MARK_ALL_READ') {
        setNotifications((current) => current.map(notification => ({ ...notification, isRead: true })));
        setNotificationUnreadCount(0);
        return;
      }

      const readIds = new Set<string>([
        ...(typeof payload.notificationId === 'string' ? [payload.notificationId] : []),
        ...(payload.notificationIds ?? []).filter((id): id is string => typeof id === 'string'),
      ]);

      if (readIds.size === 0) return;

      setNotifications((current) =>
        current.map((notification) =>
          readIds.has(notification.notificationId) ? { ...notification, isRead: true } : notification,
        ),
      );

      setNotificationUnreadCount((count) => Math.max(0, count - readIds.size));
    });

    const unsubscribeDelete = realtimeService.subscribe(`/user/${user.userId}/queue/notification-delete`, (payload: { notificationId?: string; action?: string }) => {
      if (payload.action === 'DELETE_ALL') {
        setNotifications([]);
        setNotificationUnreadCount(0);
        return;
      }

      if (!payload.notificationId) {
        return;
      }

      setNotifications((current) => {
        const target = current.find(notification => notification.notificationId === payload.notificationId);
        if (target && !target.isRead) {
          setNotificationUnreadCount((count) => Math.max(0, count - 1));
        }

        return current.filter(notification => notification.notificationId !== payload.notificationId);
      });
    });

    return () => {
      cancelled = true;
      unsubscribeNotification();
      unsubscribeRead();
      unsubscribeDelete();
    };
  }, [user?.userId]);

  const handleNotificationClick = useCallback(
    async (notification: NotificationRecord) => {
      if (!notification.isRead) {
        await markNotificationAsRead(notification.notificationId);
        setNotifications((current) => current.map((item) => (
          item.notificationId === notification.notificationId ? { ...item, isRead: true } : item
        )));
        setNotificationUnreadCount((count) => Math.max(0, count - 1));
      }

      const conversationId = getNotificationConversationId(notification);
      closeNotificationPanel();

      if (conversationId) {
        await handleSelectConversation(conversationId);
      }
      if (notification.type === 'FRIEND_REQUEST') {
        setActiveView('contacts');
      }
    },
    [closeNotificationPanel, handleSelectConversation, setActiveView],
  );

  const handleMarkAllNotificationsAsRead = useCallback(async () => {
    await markAllAsRead();
    setNotifications((current) => current.map(notification => ({ ...notification, isRead: true })));
    setNotificationUnreadCount(0);
  }, []);

  return (
    <aside className="h-full w-[300px] max-w-full flex-shrink-0 border-r border-border/60 bg-card/60 backdrop-blur-sm flex flex-col">
      <SidebarHeader
        friendRequestCount={friendRequestCount ?? 0}
        unreadNotification={notificationUnreadCount}
        isNotificationsOpen={isNotificationPanelOpen}
        onOpenContacts={handleOpenContacts}
        onOpenCreateRoom={() => setIsCreateRoomModalOpen(true)}
        onOpenSettings={() => handleOpenSettings(activeView === 'contacts' ? 'profile' : 'appearance')}
        onToggleNotifications={toggleNotificationPanel}
      />

      <SidebarSearchBar value={searchTerm} onChange={setSearchTerm} />

      <div className="relative flex-1">
        <SidebarConversationList
          conversations={filteredConversations}
          activeConversationId={activeConversationId}
          loading={loading}
          searchTerm={searchTerm}
          onSelectConversation={handleSelectConversation}
          onPinConversation={pinConversation}
          onUnpinConversation={unpinConversation}
          sentinelRef={sentinelRef}
        />
      </div>

      <SidebarFooter
        user={user}
        onOpenContacts={() => setActiveView('contacts')}
        onOpenSettings={() => handleOpenSettings(activeView === 'contacts' ? 'profile' : 'appearance')}
      />

      <SidebarNotificationPanel
        isOpen={isNotificationPanelOpen}
        notifications={notifications}
        onClose={closeNotificationPanel}
        onMarkAsRead={markNotificationAsRead}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        onNotificationClick={handleNotificationClick}
      />

      <UserSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        initialTab={settingsModalTab}
      />
      <CreateRoomModal
        isOpen={isCreateRoomModalOpen}
        onClose={() => setIsCreateRoomModalOpen(false)}
      />
    </aside>
  );
};

export default ChatSidebar;
