import { memo, type FC, type ReactNode } from "react";
import { usePresence } from "@/features/presence/model/presence.store";
import { StatusDot } from "@/features/presence/ui/StatusSelector";
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
  /** Null means the accepted-friend scope; undefined means presence is not shown. */
  presenceScope?: null;
}

export const ContactRow: FC<ContactRowProps> = memo(({
  userId,
  displayName,
  userName,
  avatarUrl,
  onUserClick,
  actions,
  subtitle,
  presenceScope,
}) => {
  const { presence } = usePresence(userId);
  const isOnline = presence?.isOnline ?? false;
  const status = presence?.status ?? "OFFLINE";
  const presenceRef = useTrackPresenceInViewport<HTMLDivElement>(
    presenceScope === undefined ? [] : [userId],
    presenceScope ?? null,
  );

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
          {presenceScope !== undefined ? (
            <StatusDot
              status={status}
              isOnline={isOnline}
              size="md"
              className="absolute bottom-[-1px] right-[-1px] border-2 border-background"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-snug sm:text-base">{displayName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">@{userName}</p>
            {subtitle ? (
                <span className="max-w-full truncate text-xs font-medium text-primary">{subtitle}</span>
            ) : null}
          </div>
        </div>
      </button>

      <div className="mt-1 flex shrink-0 flex-wrap justify-end gap-2 opacity-100 sm:mt-0 sm:flex-nowrap sm:opacity-85">
        {actions}
      </div>
    </div>
  );
});
