import Link from 'next/link';
import type { MouseEvent } from 'react';
import { useState } from 'react';
import { Bell, Compass, MessageCircle, Plus, Search, Settings, UserRound, Users } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/shared/lib/cn';
import { localizeText } from '@/shared/i18n';
import { UserSettingsModal } from '@/features/settings/ui/UserSettingsModal';

interface AppNavigationRailProps {
  activeTarget?: string;
  onCreateRoom?: () => void;
  onOpenChatList?: () => void;
  onOpenFriendsList?: () => void;
}

const navigationItems = [
  { to: '/app', label: 'Mở hội thoại', icon: MessageCircle },
  { to: '/friends', label: 'Mở bạn bè', icon: Users },
  { to: '/communities', label: 'Mở cộng đồng', icon: Compass },
  { to: '/search', label: 'Tìm kiếm', icon: Search },
  { to: '/profile', label: 'Hồ sơ cá nhân', icon: UserRound },
  { to: '/settings', label: 'Cài đặt', icon: Settings },
];

const itemClassName = 'focus-ring inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground';

const isActivePath = (pathname: string, target: string) => {
  if (target === '/app') return pathname === '/app';
  return pathname === target || pathname.startsWith(`${target}/`);
};

export const AppNavigationRail = ({
  activeTarget,
  onCreateRoom,
  onOpenChatList,
  onOpenFriendsList,
}: AppNavigationRailProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const resolvedActiveTarget = activeTarget ?? pathname;
  const mobileItems = navigationItems.filter((item) => ['/app', '/friends', '/profile', '/settings'].includes(item.to));

  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>, target: string) => {
    if (target === '/app' && onOpenChatList) {
      event.preventDefault();
      onOpenChatList();
      return;
    }
    if (target === '/friends' && onOpenFriendsList) {
      event.preventDefault();
      onOpenFriendsList();
    }
  };

  const openCreateRoom = () => {
    if (onCreateRoom) {
      onCreateRoom();
      return;
    }
    router.push('/app?createRoom=1');
  };

  const renderNavigationItem = (item: (typeof navigationItems)[number]) => {
    const Icon = item.icon;
    const active = isActivePath(resolvedActiveTarget, item.to);

    if (item.to === '/settings') {
      return (
        <button
          key={item.to}
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          aria-label={localizeText(item.label)}
          aria-current={active ? 'page' : undefined}
          title={localizeText(item.label)}
          className={cn(itemClassName, active && 'bg-primary text-primary-foreground shadow-[0_8px_24px_hsl(var(--primary)/.2)]')}
        >
          <Icon size={19} aria-hidden="true" />
        </button>
      );
    }

    return (
      <Link
        key={item.to}
        href={item.to}
        onClick={(event) => handleNavigation(event, item.to)}
        aria-label={localizeText(item.label)}
        aria-current={active ? 'page' : undefined}
        title={localizeText(item.label)}
        className={cn(itemClassName, active && 'bg-primary text-primary-foreground shadow-[0_8px_24px_hsl(var(--primary)/.2)]')}
      >
        <Icon size={19} aria-hidden="true" />
      </Link>
    );
  };

  return (
    <>
      <aside className="hidden h-full w-20 shrink-0 flex-col items-center border-r border-border bg-card/80 py-4 md:flex" aria-label={localizeText('Điều hướng ứng dụng')}>
        <nav className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={openCreateRoom}
            aria-label={localizeText('Tạo phòng mới')}
            title={localizeText('Tạo phòng mới')}
            className={itemClassName}
          >
            <Plus size={19} aria-hidden="true" />
          </button>
          {navigationItems.map(renderNavigationItem)}
        </nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-border bg-card/95 px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label={localizeText('Điều hướng di động')}>
        {mobileItems.map((item) => {
          return renderNavigationItem(item);
        })}
        <Link
          href="/app?notifications=1"
          aria-label={localizeText('Thông báo')}
          className={itemClassName}
        >
          <Bell size={19} aria-hidden="true" />
        </Link>
      </nav>
      <UserSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab="profile"
      />
    </>
  );
};

export default AppNavigationRail;
