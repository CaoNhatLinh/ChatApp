import { Menu, Settings } from "lucide-react";
import { StatusDot } from "@/features/presence/ui/StatusSelector";
import { usePresenceStore } from "@/features/presence/model/presence.store";
import type { User } from "@/features/auth/types/auth.types";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/cn";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";

interface SidebarFooterProps {
  user: User | null;
  onOpenSettings: () => void;
  onOpenContacts: () => void;
}

const getUserDisplay = (value: string | undefined) => (value?.trim() ? value.trim() : "?");

export const SidebarFooter = ({ user, onOpenSettings, onOpenContacts }: SidebarFooterProps) => {
  const myStatus = usePresenceStore((state) => state.myStatus);
  const isOnline = myStatus === "ONLINE" || myStatus === "DND";

  return (
    <div className="border-t border-border/50 px-4 py-3">
      <div className="rounded-[1rem] p-2">
        <button
          onClick={onOpenSettings}
          type="button"
          className={cn(
            "w-full group relative flex items-center gap-3 rounded-[1rem] px-3 py-2 text-left",
            "transition-all hover:bg-accent/60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          )}
        >
          <div className="relative">
            <div className="h-10 w-10 rounded-[0.95rem] border-2 border-border/60 bg-primary/10 flex items-center justify-center overflow-hidden">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-black uppercase tracking-tight text-primary">
                  {getUserDisplay(user?.displayName).charAt(0)}
                </span>
              )}
            </div>
            <StatusDot
              status={myStatus}
              isOnline={isOnline}
              size="md"
              className="absolute -bottom-1 -right-1 border border-background rounded-full"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{getUserDisplay(user?.displayName)}</p>
            <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">@{getUserDisplay(user?.userName)}</p>
          </div>

          <div className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(event) => {
                event.stopPropagation();
                onOpenContacts();
              }}
              aria-label={MESSENGER_COPY.sidebar.footer.contactsAriaLabel}
            >
              <Menu size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(event) => {
                event.stopPropagation();
                onOpenSettings();
              }}
              aria-label={MESSENGER_COPY.sidebar.footer.settingsAriaLabel}
            >
              <Settings size={16} />
            </Button>
          </div>
        </button>
      </div>
    </div>
  );
};

export default SidebarFooter;
