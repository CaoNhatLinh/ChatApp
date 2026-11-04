import { useCallback, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { isAxiosError } from 'axios';
import { CallHistoryDialog } from '@/features/calls/ui/CallHistoryDialog';
import { useConversationDirectory } from '@/features/messenger/model/useConversationDirectory';
import { getConversationById, type ConversationFilter } from '@/features/messenger/api/messenger.api';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import { CreateRoomModal } from '@/features/messenger/components/Modals/CreateRoomModal';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useMessenger } from '@/features/messenger/model/useMessenger';
import { useMessengerStore } from '@/features/messenger/model/messenger.store';
import { getSessionGeneration } from '@/shared/auth/access-token';
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
  useAppLocale();
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
    hoistConversation,
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
  const [filter, setFilter] = useState<ConversationFilter>('ALL');
  const browsing = searchTerm.trim().length > 0 || filter !== 'ALL';
  const directory = useConversationDirectory(searchTerm, filter, browsing);
  const changePin = async (conversationId: string, pinned: boolean) => {
    const generation = getSessionGeneration();
    try {
      await (pinned ? pinConversation : unpinConversation)(conversationId);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409 && generation === getSessionGeneration()) {
        if (browsing) await directory.reload();
        else {
          const current = await getConversationById(conversationId).catch(() => null);
          if (current && generation === getSessionGeneration()) {
            const store = useMessengerStore.getState();
            (current.isPinned ? store.pinConversation : store.unpinConversation)(conversationId);
          }
        }
      }
      throw error;
    }
    await directory.reload();
  };
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [isCallHistoryOpen, setIsCallHistoryOpen] = useState(false);

  const filteredConversations = browsing ? directory.content : conversations;

  const handleSelectConversation = useCallback(
    async (conversationId: string) => {
      const found = filteredConversations.find(conversation => conversation.conversationId === conversationId);
      if (found) hoistConversation(found);
      await selectConversation(conversationId);
    },
    [filteredConversations, hoistConversation, selectConversation],
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
    <aside className="messenger-sidebar flex h-full w-full max-w-full flex-shrink-0 flex-col border-r border-border/60 pb-16 text-foreground md:pb-0">
      <div className="md:hidden">
        <SidebarHeader
          onOpenCreateRoom={() => setIsCreateRoomModalOpen(true)}
        />
      </div>

      <SidebarSearchBar value={searchTerm} onChange={setSearchTerm} />
      <div className="flex gap-1 px-4 pb-3" role="group" aria-label={localizeText('Lọc cuộc trò chuyện')}>
        {(['ALL', 'UNREAD', 'PINNED'] as const).map(value => <Button key={value} type="button" size="sm"
          variant={filter === value ? 'secondary' : 'ghost'} aria-pressed={filter === value} onClick={() => setFilter(value)}>
          {localizeText(value === 'ALL' ? 'Tất cả' : value === 'UNREAD' ? 'Chưa đọc' : 'Đã ghim')}
        </Button>)}
        <Button type="button" size="icon" variant="ghost" className="ml-auto h-9 w-9 shrink-0" data-call-history-trigger="own"
          aria-label={localizeText('Lịch sử cuộc gọi của bạn')} title={localizeText('Lịch sử cuộc gọi của bạn')}
          onClick={() => setIsCallHistoryOpen(true)}><History size={18} aria-hidden="true" /></Button>
      </div>
      {isCallHistoryOpen ? <CallHistoryDialog onClose={() => setIsCallHistoryOpen(false)} /> : null}
      {browsing && directory.error ? <div role="alert" className="space-y-2 px-4 pb-3 text-sm"><p>{directory.error}</p><Button variant="outline" onClick={() => void directory.retry()}>{localizeText('Thử lại')}</Button></div> : null}

      <div className="relative min-h-0 flex-1">
        <SidebarConversationList
          conversations={filteredConversations}
          error={browsing && Boolean(directory.error)}
          filtered={browsing}
          activeConversationId={activeConversationId}
          loading={browsing ? directory.loading : loading}
          searchTerm={searchTerm}
          onSelectConversation={handleSelectConversation}
          onPinConversation={id => changePin(id, true)}
          onUnpinConversation={id => changePin(id, false)}
          hasNext={browsing ? directory.hasNext && !directory.error : conversationsPagination.hasNext}
          loadingMore={browsing ? directory.loading : conversationsPagination.loading}
          onLoadMore={browsing ? directory.loadMore : loadMoreConversations}
        />
      </div>

      <SidebarFooter
        user={user}
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
