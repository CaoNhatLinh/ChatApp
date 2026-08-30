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
    </aside>
  );
};

export default ProfileIdentityCard;
