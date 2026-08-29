import { memo, type FC, type ReactNode } from "react";
import { usePresence } from "@/features/presence/model/presence.store";
import { StatusDot } from "@/features/presence/ui/StatusSelector";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import { localizeText } from "@/shared/i18n";
import { useTrackPresenceInViewport } from "@/features/presence/hooks/useTrackPresence";

interface ContactRowProps {
  userId: string;
  displayName: string;
  userName: string;
  avatarUrl?: string;
  onUserClick: (id: string) => void;
  actions: ReactNode;
  subtitle?: string;
}

const getStatusLabel = (status: "ONLINE" | "OFFLINE" | "DND"): string => {
  if (status === "DND") return MESSENGER_COPY.presence.statusLabel.dnd;
  if (status === "ONLINE") return MESSENGER_COPY.presence.statusLabel.online;
  if (status === "OFFLINE") return MESSENGER_COPY.presence.statusLabel.offline;
  throw new Error(`Unsupported contact presence status: ${status}`);
};

export const ContactRow: FC<ContactRowProps> = memo(({
  userId,
  displayName,
  userName,
  avatarUrl,
  onUserClick,
  actions,
  subtitle,
}) => {
  const { presence } = usePresence(userId);
  const isOnline = presence?.isOnline ?? false;
  const status = presence?.status ?? "OFFLINE";
  const presenceRef = useTrackPresenceInViewport<HTMLDivElement>([userId]);

  return (
    <div ref={presenceRef} className="group flex items-center justify-between rounded-[var(--radius-lg)] border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30">
      <button
        onClick={() => onUserClick(userId)}
        className="group flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 sm:gap-4"
        type="button"
      >
        <div className="relative">
          <div className="h-12 w-12 overflow-hidden rounded-[var(--radius-md)] bg-primary/10 border border-primary/20 flex items-center justify-center font-semibold text-primary text-lg">
            {avatarUrl ? <img src={avatarUrl} alt={localizeText("Ảnh đại diện")} className="h-full w-full object-cover" /> : displayName.charAt(0).toUpperCase()}
          </div>
          <StatusDot
            status={status}
            isOnline={isOnline}
            size="md"
            className="absolute bottom-[-1px] right-[-1px] border-2 border-background"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-snug sm:text-base">{displayName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">@{userName}</p>
            {subtitle ? (
                <span className="max-w-full truncate text-xs font-medium text-primary">{subtitle}</span>
            ) : (
              <>
                <StatusDot status={status} isOnline={isOnline} size="sm" className="w-1.5 h-1.5" />
                <span className="truncate text-xs text-muted-foreground">
                {getStatusLabel(status)}
                </span>
              </>
            )}
          </div>
        </div>
      </button>

      <div className="mt-1 flex shrink-0 flex-wrap justify-end gap-2 opacity-100 sm:mt-0 sm:flex-nowrap sm:opacity-85">
        {actions}
      </div>
    </div>
  );
});
