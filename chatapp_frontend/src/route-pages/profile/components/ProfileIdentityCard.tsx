import Link from "next/link";
import { Settings } from "lucide-react";
import { localizeText } from "@/shared/i18n";

interface ProfileIdentityCardProps {
  display: string;
  userName: string;
}

export const ProfileIdentityCard = ({
  display,
  userName,
}: ProfileIdentityCardProps) => {
  return (
    <aside className="border-b border-border py-6 md:border-b-0 md:border-r md:pr-6">
      <div className="mx-auto h-20 w-20 overflow-hidden rounded-[1.25rem] border border-border bg-accent">
        <img src="/noi-default-avatar.webp" alt={localizeText('Ảnh đại diện mặc định')} className="h-full w-full object-cover" />
      </div>
      <h2 className="mt-4 text-center text-lg font-semibold">{display}</h2>
      <p className="mt-1 text-xs text-center text-muted-foreground break-all">@{userName}</p>
      <div className="border-t border-border pt-3 mt-5">
        <Link
          href="/settings?tab=profile"
          className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
        >
          <Settings size={16} />
          {localizeText("Cài đặt")}
        </Link>
      </div>
    </aside>
  );
};

export default ProfileIdentityCard;
