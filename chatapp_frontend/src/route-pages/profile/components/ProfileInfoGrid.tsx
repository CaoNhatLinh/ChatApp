import { localizeText } from '@/shared/i18n';

interface ProfileInfoGridProps {
  userId: string;
  userName: string;
}

export const ProfileInfoGrid = ({
  userId,
  userName,
}: ProfileInfoGridProps) => {
  return (
    <section className="border-b border-border px-0 py-6 md:pl-8">
      <p className="page-kicker">{localizeText('Thông tin tài khoản')}</p>
      <dl className="mt-4 divide-y divide-border border-y border-border">
        <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:items-baseline sm:gap-4">
          <dt className="text-xs text-muted-foreground">{localizeText('Mã người dùng')}</dt>
          <dd className="font-medium break-all">{userId}</dd>
        </div>
        <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:items-baseline sm:gap-4">
          <dt className="text-xs text-muted-foreground">{localizeText('Tên đăng nhập')}</dt>
          <dd className="font-medium">{userName}</dd>
        </div>
      </dl>
    </section>
  );
};

export default ProfileInfoGrid;
