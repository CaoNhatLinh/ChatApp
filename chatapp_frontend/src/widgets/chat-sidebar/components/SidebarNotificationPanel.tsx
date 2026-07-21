import { NotificationList } from '@/features/notifications/components/notification/NotificationList';
import type { NotificationRecord } from '@/features/notifications/api/notifications.api';

interface SidebarNotificationPanelProps {
  isOpen: boolean;
  notifications: NotificationRecord[];
  onClose: () => void;
  onMarkAsRead: (notificationId: string) => Promise<void> | void;
  onMarkAllAsRead: () => void | Promise<void>;
  onNotificationClick: (notification: NotificationRecord) => void | Promise<void>;
}

export const SidebarNotificationPanel = ({
  isOpen,
  notifications,
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
        onMarkAsRead={onMarkAsRead}
        onMarkAllAsRead={onMarkAllAsRead}
        onNotificationClick={onNotificationClick}
      />
    </div>
  );
};

export default SidebarNotificationPanel;
