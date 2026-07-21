import { Link } from "react-router-dom";
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
    <aside className="surface p-6 border border-border/65">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-border/60 text-2xl font-black">
        {avatarText}
      </div>
      <h2 className="mt-4 text-center text-lg font-semibold">{display}</h2>
      <p className="mt-1 text-xs text-center text-muted-foreground break-all">@{userName}</p>
      <div className="border-t border-border pt-3 mt-5">
        <Link
          to="/settings?tab=profile"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm font-semibold hover:bg-card"
        >
          <Settings size={16} />
          Cài đặt
        </Link>
      </div>
    </aside>
  );
};

export default ProfileIdentityCard;
