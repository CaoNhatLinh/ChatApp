import { NotificationList } from '@/features/notifications/components/notification/NotificationList';
import type { NotificationRecord } from '@/features/notifications/api/notifications.api';

interface SidebarNotificationPanelProps {
  isOpen: boolean;
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void | Promise<void>;
  hasNext: boolean;
  loadingMore: boolean;
  loadMoreError: string | null;
  onLoadMore: () => void | Promise<void>;
  onClose: () => void;
  onMarkAsRead: (notificationId: string) => Promise<void> | void;
  onMarkAllAsRead: () => void | Promise<void>;
  onNotificationClick: (notification: NotificationRecord) => void | Promise<void>;
}

export const SidebarNotificationPanel = ({
  isOpen,
  notifications,
  unreadCount,
  loading,
  error,
  onRetry,
  hasNext,
  loadingMore,
  loadMoreError,
  onLoadMore,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick,
}: SidebarNotificationPanelProps) => {
  return (
    <div className="absolute top-16 right-2 z-20">
      <NotificationList
        isOpen={isOpen}
        onClose={onClose}
        notifications={notifications}
        unreadCount={unreadCount}
        loading={loading}
        error={error}
        onRetry={onRetry}
        hasNext={hasNext}
        loadingMore={loadingMore}
        loadMoreError={loadMoreError}
        onLoadMore={onLoadMore}
        onMarkAsRead={onMarkAsRead}
        onMarkAllAsRead={onMarkAllAsRead}
        onNotificationClick={onNotificationClick}
      />
    </div>
  );
};

export default SidebarNotificationPanel;
