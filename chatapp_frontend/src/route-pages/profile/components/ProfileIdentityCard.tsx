import Link from "next/link";
import { Settings } from "lucide-react";

interface ProfileIdentityCardProps {
  display: string;
  userName: string;
  avatarText: string;
}

export const ProfileIdentityCard = ({
  display,
  userName,
  avatarText,
}: ProfileIdentityCardProps) => {
  return (
    <aside className="product-surface p-6">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.25rem] bg-accent text-2xl font-bold">
        {avatarText}
      </div>
      <h2 className="mt-4 text-center text-lg font-semibold">{display}</h2>
      <p className="mt-1 text-xs text-center text-muted-foreground break-all">@{userName}</p>
      <div className="border-t border-border pt-3 mt-5">
        <Link
          href="/settings?tab=profile"
          className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
        >
          <Settings size={16} />
          Cài đặt
        </Link>
      </div>
    </aside>
  );
};

export default ProfileIdentityCard;
