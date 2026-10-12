import Link from 'next/link';
import type { MouseEvent } from 'react';
import { useState } from 'react';
import { Bell, Compass, MessageCircle, Plus, Settings } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/shared/lib/cn';
import { localizeText } from '@/shared/i18n';
import { UserSettingsModal } from '@/features/settings/ui/UserSettingsModal';
import { BrandMark } from '@/shared/ui/Brand';

interface AppNavigationRailProps {
  activeTarget?: string;
  onCreateRoom?: () => void;
  onOpenChatList?: () => void;
}

const navigationItems = [
  { to: '/app', label: 'Mở hội thoại', icon: MessageCircle },
  { to: '/communities', label: 'Mở cộng đồng', icon: Compass },
  { to: '/settings', label: 'Cài đặt', icon: Settings },
];

const itemClassName = 'workspace-nav-item focus-ring inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground';

const isActivePath = (pathname: string, target: string) => {
  if (target === '/app') return pathname === '/app';
  return pathname === target || pathname.startsWith(`${target}/`);
};

export const AppNavigationRail = ({
  activeTarget,
  onCreateRoom,
  onOpenChatList,
}: AppNavigationRailProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const resolvedActiveTarget = activeTarget ?? pathname;
  const mobileItems = navigationItems.filter((item) => ['/app', '/communities', '/settings'].includes(item.to));

  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>, target: string) => {
    if (target === '/app' && onOpenChatList) {
      event.preventDefault();
      onOpenChatList();
      return;
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
          className={cn(itemClassName, active && 'workspace-nav-active')}
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
        className={cn(itemClassName, active && 'workspace-nav-active')}
      >
        <Icon size={19} aria-hidden="true" />
      </Link>
    );
  };

  return (
    <>
      <aside className="app-navigation-rail hidden min-h-[100dvh] self-stretch w-20 shrink-0 flex-col items-center py-4 md:flex" aria-label={localizeText('Điều hướng ứng dụng')}>
        <div className="flex min-h-0 w-full flex-1 flex-col items-center">
          <nav className="flex flex-col items-center gap-2" aria-label={localizeText('Điều hướng không gian')}>
            <Link
              href="/app"
              aria-label={`${localizeText('Nối')} — ${localizeText('Mở workspace')}`}
              title={localizeText('Mở workspace')}
              className="workspace-brand-link focus-ring inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)]"
            >
              <BrandMark className="h-full w-full" />
            </Link>
            {navigationItems.filter((item) => item.to !== '/settings').map(renderNavigationItem)}
            <button
              type="button"
              onClick={openCreateRoom}
              aria-label={localizeText('Tạo phòng mới')}
              title={localizeText('Tạo phòng mới')}
              className={itemClassName}
            >
              <Plus size={19} aria-hidden="true" />
            </button>
          </nav>
          <div className="mt-auto">
            {navigationItems.filter((item) => item.to === '/settings').map(renderNavigationItem)}
          </div>
        </div>
      </aside>

      <nav className="workspace-mobile-nav fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around px-4 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label={localizeText('Điều hướng di động')}>
        <Link
          href="/app"
          aria-label={`${localizeText('Nối')} — ${localizeText('Mở workspace')}`}
          title={localizeText('Mở workspace')}
          className="workspace-brand-link focus-ring inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)]"
        >
          <BrandMark className="h-full w-full" />
        </Link>
        {mobileItems.filter((item) => item.to !== '/settings').map(renderNavigationItem)}
        <button
          type="button"
          onClick={openCreateRoom}
          aria-label={localizeText('Tạo phòng mới')}
          title={localizeText('Tạo phòng mới')}
          className={itemClassName}
        >
          <Plus size={19} aria-hidden="true" />
        </button>
        <Link
          href="/app?notifications=1"
          aria-label={localizeText('Thông báo')}
          className={itemClassName}
        >
          <Bell size={19} aria-hidden="true" />
        </Link>
        {mobileItems.filter((item) => item.to === '/settings').map(renderNavigationItem)}
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
