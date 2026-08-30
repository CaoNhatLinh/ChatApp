import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import { CreateRoomModal } from '@/features/messenger/components/Modals/CreateRoomModal';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useMessenger } from '@/features/messenger/model/useMessenger';
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

export const ChatSidebar = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const {
    conversations,
    selectConversation,
    activeConversationId,
    setActiveView,
    loading,
    pinConversation,
    unpinConversation,
    loadMoreConversations,
    conversationsPagination,
    setSidebarOpen,
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

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        conversation.name.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [conversations, searchTerm],
  );

  const handleSelectConversation = useCallback(
    async (conversationId: string) => {
      await selectConversation(conversationId);
    },
    [selectConversation],
  );

  const closeNotificationPanel = useCallback(() => {
    setIsNotificationPanelOpen(false);
    if (searchParams.get('notifications') !== '1') return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('notifications');
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [pathname, router, searchParams, setSidebarOpen]);

  useEffect(() => {
    if (searchParams.get('notifications') === '1') setIsNotificationPanelOpen(true);
  }, [searchParams]);

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
    <aside className="messenger-sidebar flex h-full w-full max-w-full flex-shrink-0 flex-col border-r border-white/10 pb-16 text-foreground md:pb-0">
      <div className="md:hidden">
        <SidebarHeader
          onOpenCreateRoom={() => setIsCreateRoomModalOpen(true)}
        />
      </div>

      <SidebarSearchBar value={searchTerm} onChange={setSearchTerm} />

      <div className="relative min-h-0 flex-1">
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
        onOpenProfile={() => router.push('/profile')}
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

      <CreateRoomModal
        isOpen={isCreateRoomModalOpen}
        onClose={() => setIsCreateRoomModalOpen(false)}
      />
    </aside>
  );
};

export default ChatSidebar;
