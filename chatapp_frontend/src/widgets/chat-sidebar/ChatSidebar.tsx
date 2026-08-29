import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CreateRoomModal } from '@/features/messenger/components/Modals/CreateRoomModal';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useMessenger } from '@/features/messenger/model/useMessenger';
import { UserSettingsModal } from '@/features/settings/ui/UserSettingsModal';
import {
  getNotificationConversationId,
  type NotificationRecord,
} from '@/features/notifications/api/notifications.api';
import { useNotificationStore } from '@/features/notifications/model/notification.store';
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
    loading,
    pinConversation,
    unpinConversation,
    loadMoreConversations,
    conversationsPagination,
    friendRequestCount,
  } = useMessenger();

  const { user } = useAuthStore();
  const {
    notifications,
    loading: notificationsLoading,
    error: notificationsError,
    hasNext: notificationsHasNext,
    loadingMore: notificationsLoadingMore,
    loadMoreError: notificationsLoadMoreError,
    unreadCount: notificationUnreadCount,
    initNotifications,
    loadMoreNotifications,
    connectRealtime: connectNotificationRealtime,
    disconnectRealtime: disconnectNotificationRealtime,
    markOneAsRead,
    markEverythingAsRead,
  } = useNotificationStore(useShallow((state) => ({
    notifications: state.notifications,
    loading: state.loading,
    error: state.error,
    hasNext: state.hasNext,
    loadingMore: state.loadingMore,
    loadMoreError: state.loadMoreError,
    unreadCount: state.unreadCount,
    initNotifications: state.initNotifications,
    loadMoreNotifications: state.loadMoreNotifications,
    connectRealtime: state.connectRealtime,
    disconnectRealtime: state.disconnectRealtime,
    markOneAsRead: state.markOneAsRead,
    markEverythingAsRead: state.markEverythingAsRead,
  })));

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsModalTab, setSettingsModalTab] = useState<SettingsTab>('profile');

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        conversation.name.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [conversations, searchTerm],
  );

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
    if (!user?.userId) return;
    void initNotifications();
    connectNotificationRealtime(user.userId);

    return () => {
      disconnectNotificationRealtime();
    };
  }, [connectNotificationRealtime, disconnectNotificationRealtime, initNotifications, user?.userId]);

  const handleNotificationClick = useCallback(
    async (notification: NotificationRecord) => {
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
    await markEverythingAsRead();
  }, [markEverythingAsRead]);

  return (
    <aside className="h-full w-[320px] max-w-full flex-shrink-0 border-r border-border bg-background flex flex-col">
      <SidebarHeader
        friendRequestCount={friendRequestCount}
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
          hasNext={conversationsPagination.hasNext && searchTerm.trim().length === 0}
          loadingMore={conversationsPagination.loading}
          onLoadMore={loadMoreConversations}
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
        unreadCount={notificationUnreadCount}
        loading={notificationsLoading}
        error={notificationsError}
        onRetry={initNotifications}
        hasNext={notificationsHasNext}
        loadingMore={notificationsLoadingMore}
        loadMoreError={notificationsLoadMoreError}
        onLoadMore={loadMoreNotifications}
        onClose={closeNotificationPanel}
        onMarkAsRead={markOneAsRead}
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
