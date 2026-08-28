import { Plus, Settings, Users } from "lucide-react";
import { NotificationButton } from "@/features/notifications/components/notification/NotificationList";
import { Button } from "@/shared/ui/Button";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import { BrandMark } from "@/shared/ui/Brand";

interface SidebarHeaderProps {
  friendRequestCount: number;
  unreadNotification: number;
  isNotificationsOpen: boolean;
  onOpenContacts: () => void;
  onOpenCreateRoom: () => void;
  onOpenSettings: () => void;
  onToggleNotifications: () => void;
}

export const SidebarHeader = ({
  friendRequestCount,
  unreadNotification,
  isNotificationsOpen,
  onOpenContacts,
  onOpenCreateRoom,
  onOpenSettings,
  onToggleNotifications,
}: SidebarHeaderProps) => {
  return (
    <div className="border-b border-border px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <BrandMark className="h-6 w-6 rounded-[0.45rem]" />
            <p className="page-kicker">NovaChat</p>
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">{MESSENGER_COPY.sidebar.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <NotificationButton
            unreadCount={unreadNotification}
            isOpen={isNotificationsOpen}
            onClick={onToggleNotifications}
          />

          <Button
            variant="outline"
            size="icon"
            onClick={onOpenContacts}
            aria-label={MESSENGER_COPY.sidebar.header.contactsAriaLabel}
            className={friendRequestCount > 0 ? "text-primary border-primary/40" : undefined}
            title={MESSENGER_COPY.sidebar.header.contactsTitle}
          >
            <Users size={18} />
            {friendRequestCount > 0 ? (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-black inline-flex items-center justify-center">
                {friendRequestCount > 99 ? '99+' : friendRequestCount}
              </span>
            ) : null}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={onOpenCreateRoom}
            aria-label={MESSENGER_COPY.sidebar.header.createRoomAriaLabel}
            title={MESSENGER_COPY.sidebar.header.createRoomTitle}
          >
            <Plus size={18} />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={onOpenSettings}
            aria-label={MESSENGER_COPY.sidebar.header.settingsAriaLabel}
            title={MESSENGER_COPY.sidebar.header.settingsTitle}
          >
            <Settings size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SidebarHeader;
