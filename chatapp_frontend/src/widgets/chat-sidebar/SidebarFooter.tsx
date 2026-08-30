import { Settings } from "lucide-react";
import { StatusDot, StatusSelector } from "@/features/presence/ui/StatusSelector";
import { usePresenceStore } from "@/features/presence/model/presence.store";
import type { User } from "@/features/auth/types/auth.types";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/cn";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import { localizeText } from "@/shared/i18n";
import { LanguageToggle } from "@/shared/ui/LanguageToggle";

interface SidebarFooterProps {
  user: User | null;
  onOpenSettings: () => void;
}

const getUserDisplay = (value: string | undefined) => (value?.trim() ? value.trim() : "?");

export const SidebarFooter = ({ user, onOpenSettings }: SidebarFooterProps) => {
  const myStatus = usePresenceStore((state) => state.myStatus);
  const isOnline = myStatus === "ONLINE" || myStatus === "DND";

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="rounded-[var(--radius-md)] p-1">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            onClick={onOpenSettings}
            className={cn(
              "h-auto min-w-0 flex-1 group relative flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left",
              "transition-[color,background-color,border-color,box-shadow,transform,opacity] hover:bg-accent/60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            )}
          >
            <div className="relative">
              <div className="h-10 w-10 rounded-[var(--radius-md)] border border-border bg-primary/10 flex items-center justify-center overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={localizeText("Ảnh đại diện")} className="h-full w-full object-cover" />
                ) : <img src="/noi-default-avatar.webp" alt={localizeText("Ảnh đại diện mặc định")} className="h-full w-full object-cover" />}
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
              <p className="truncate text-xs text-muted-foreground">@{getUserDisplay(user?.userName)}</p>
            </div>
          </Button>
          <div className="flex shrink-0 gap-1">
            <LanguageToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
              aria-label={MESSENGER_COPY.sidebar.footer.settingsAriaLabel}
            >
              <Settings size={16} />
            </Button>
          </div>
        </div>
        <StatusSelector className="mt-2 w-full justify-start px-3 text-xs text-muted-foreground hover:text-foreground" />
      </div>
    </div>
  );
};

export default SidebarFooter;

