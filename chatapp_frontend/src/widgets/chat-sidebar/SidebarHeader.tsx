import { Plus, Settings, Users } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";

interface SidebarHeaderProps {
  friendRequestCount: number;
  onOpenContacts: () => void;
  onOpenCreateRoom: () => void;
  onOpenSettings: () => void;
}

export const SidebarHeader = ({
  friendRequestCount,
  onOpenContacts,
  onOpenCreateRoom,
  onOpenSettings,
}: SidebarHeaderProps) => {
  return (
    <div className="border-b border-border px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">{MESSENGER_COPY.sidebar.title}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenContacts}
            aria-label={MESSENGER_COPY.sidebar.header.contactsAriaLabel}
            className={friendRequestCount > 0 ? "border-primary/40 text-primary" : "border-white/10 bg-transparent text-foreground hover:bg-white/6"}
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
            className="border-white/10 bg-transparent text-foreground hover:bg-white/6"
          >
            <Plus size={18} />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={onOpenSettings}
            aria-label={MESSENGER_COPY.sidebar.header.settingsAriaLabel}
            title={MESSENGER_COPY.sidebar.header.settingsTitle}
            className="border-white/10 bg-transparent text-foreground hover:bg-white/6"
          >
            <Settings size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SidebarHeader;
