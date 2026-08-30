import { Plus } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";

interface SidebarHeaderProps {
  onOpenCreateRoom: () => void;
}

export const SidebarHeader = ({
  onOpenCreateRoom,
}: SidebarHeaderProps) => {
  return (
    <div className="border-b border-border px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">{MESSENGER_COPY.sidebar.title}</h2>
        <div className="flex items-center gap-2">
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
        </div>
      </div>
    </div>
  );
};

export default SidebarHeader;
