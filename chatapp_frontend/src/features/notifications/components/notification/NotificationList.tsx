import { Bell, Heart, MessageCircle, Reply, User, UserPlus, X } from "lucide-react";
import { motion } from "framer-motion";
import type { NotificationRecord, NotificationType } from "@/features/notifications/api/notifications.api";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";
import { getLocale, localizeText } from '@/shared/i18n';

interface NotificationListProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationRecord[];
  onMarkAsRead: (notificationId: string) => void | Promise<void>;
  onMarkAllAsRead: () => void | Promise<void>;
  onNotificationClick: (notification: NotificationRecord) => void | Promise<void>;
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case "MESSAGE":
      return <MessageCircle className="w-4 h-4 text-primary" />;
    case "FRIEND_REQUEST":
      return <UserPlus className="w-4 h-4 text-success" />;
    case "REACTION":
      return <Heart className="w-4 h-4 text-destructive" />;
    case "MENTION":
      return <User className="w-4 h-4 text-primary" />;
    case "REPLY":
      return <Reply className="w-4 h-4 text-warning" />;
    case "SYSTEM":
    case "CONVERSATION_INVITE":
    case "POLL":
    case "PIN_MESSAGE":
    default:
      return <Bell className="w-4 h-4 text-muted-foreground" />;
  }
};

const getTimeLabel = (timestamp: string) => {
  const parsed = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / 1000));

  if (diffInSeconds < 60) return localizeText("Vừa xong");
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return localizeText(`${diffInMinutes} phút trước`);
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return localizeText(`${diffInHours} giờ trước`);
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return localizeText(`${diffInDays} ngày trước`);
  return parsed.toLocaleDateString(getLocale() === 'en' ? 'en-US' : 'vi-VN');
};

export const NotificationList: React.FC<NotificationListProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick,
}) => {
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleNotificationClick = (notification: NotificationRecord) => {
    if (!notification.isRead) {
      void onMarkAsRead(notification.notificationId);
    }
    void onNotificationClick(notification);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      className="neo-shadow absolute top-12 right-2 z-50 w-[min(20rem,calc(100vw-1rem))] sm:w-80 max-h-96 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.zoomReveal}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/50 bg-primary/10 text-primary">
            <Bell size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{localizeText('Thông báo')}</h3>
            <p className="text-xs text-muted-foreground">{localizeText('Cập nhật mới nhất')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 ? (
            <button
              onClick={onMarkAllAsRead}
              className="focus-ring rounded-md px-2 py-1 text-xs font-semibold text-primary hover:text-primary/80"
            >
              {localizeText('Duyệt tất cả')}
            </button>
          ) : null}

          <button
            onClick={onClose}
            aria-label={localizeText('Đóng')}
            className="focus-ring rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto custom-scrollbar">
        {notifications.length === 0 ? (
          <motion.div
            className="flex min-h-[180px] flex-col items-center justify-center px-6 text-center"
            initial={UI_MOTION_CONFIG.initialState}
            animate={UI_MOTION_CONFIG.animateState}
            variants={UI_MOTION_VARIANTS.rowReveal}
          >
            <Bell className="h-9 w-9 text-muted-foreground opacity-65" />
            <p className="mt-3 text-sm text-muted-foreground">{localizeText('Không có thông báo nào.')}</p>
          </motion.div>
        ) : (
          <motion.div initial="hidden" animate="visible" variants={UI_MOTION_VARIANTS.panelReveal} className="space-y-0">
            {notifications.map((notification) => (
              <motion.button
                key={notification.notificationId}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full cursor-pointer px-4 py-3 border-b border-border/40 text-left transition-colors ${
                  notification.isRead ? "hover:bg-accent/40" : "bg-primary/5 hover:bg-primary/10"
                }`}
                type="button"
                variants={UI_MOTION_VARIANTS.rowReveal}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background/90">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="truncate text-sm font-semibold">{notification.title}</h4>
                      {!notification.isRead ? (
                        <span className="shrink-0 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-5 line-clamp-2">{notification.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {getTimeLabel(notification.createdAt)}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

interface NotificationButtonProps {
  unreadCount: number;
  isOpen: boolean;
  onClick: () => void;
}

export const NotificationButton: React.FC<NotificationButtonProps> = ({ unreadCount, isOpen, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`focus-ring relative inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-border transition-[color,background-color,border-color,box-shadow,transform,opacity] ${
        isOpen ? "bg-primary/10 text-primary border-primary/40" : "hover:bg-accent hover:text-foreground"
      }`}
      aria-label={localizeText('Thông báo')}
      title={localizeText('Thông báo')}
    >
      <Bell size={18} />
      {unreadCount > 0 ? (
        <span className="absolute -top-1 -right-1 rounded-full h-5 min-w-5 px-1 bg-destructive text-destructive-foreground text-[10px] font-black inline-flex items-center justify-center">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
};

export default NotificationList;

