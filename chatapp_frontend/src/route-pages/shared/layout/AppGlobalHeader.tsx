import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useNotificationStore } from '@/features/notifications/model/notification.store';
import { localizeText } from '@/shared/i18n';

export const AppGlobalHeader = () => {
  const router = useRouter();
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  return (
    <header
      className="hidden h-16 shrink-0 items-center justify-end border-b border-border/60 bg-background/90 px-6 backdrop-blur md:flex"
      aria-label={localizeText('Thanh điều hướng chung')}
    >
      <button
        type="button"
        onClick={() => router.push('/app?notifications=1')}
        aria-label={localizeText('Thông báo')}
        title={localizeText('Thông báo')}
        className="focus-ring relative inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell size={19} aria-hidden="true" />
        {unreadCount > 0 ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" aria-hidden="true" /> : null}
      </button>
    </header>
  );
};

export default AppGlobalHeader;
