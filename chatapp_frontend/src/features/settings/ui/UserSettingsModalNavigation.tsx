import { motion, useReducedMotion } from 'framer-motion';
import { Bell, Flag, KeyRound, Languages, LogOut, Palette, UserCircle } from 'lucide-react';
import type { FC, ReactNode } from 'react';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import { localizeText } from '@/shared/i18n';
import { BrandWord } from '@/shared/ui/BrandWord';

type TabType = 'profile' | 'connections' | 'appearance' | 'language' | 'notifications' | 'reports';

interface UserSettingsModalNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onLogout: () => void;
}

interface NavigationItem {
  key: TabType;
  label: string;
  description: string;
  icon: ReactNode;
}

export const UserSettingsModalNavigation: FC<UserSettingsModalNavigationProps> = ({
  activeTab,
  onTabChange,
  onLogout,
}) => {
  const reduceMotion = useReducedMotion();
  const navigationItems: NavigationItem[] = [
    {
      key: 'connections',
      label: localizeText('Cách đăng nhập'),
      description: localizeText('Mật khẩu và tài khoản Google.'),
      icon: <KeyRound size={20} />,
    },
    {
      key: 'profile',
      label: localizeText('Tài khoản & Hồ sơ'),
      description: localizeText('Tên, ảnh đại diện và tài khoản.'),
      icon: <UserCircle size={20} />,
    },
    {
      key: 'appearance',
      label: localizeText('Giao diện'),
      description: localizeText('Màu, độ sáng và nhịp hiển thị.'),
      icon: <Palette size={20} />,
    },
    {
      key: 'language',
      label: localizeText('Ngôn ngữ'),
      description: localizeText('Cách Nối nói với bạn.'),
      icon: <Languages size={20} />,
    },
    {
      key: 'notifications',
      label: localizeText('Thông báo'),
      description: localizeText('Điều gì đáng làm bạn gián đoạn.'),
      icon: <Bell size={20} />,
    },
    {
      key: 'reports',
      label: localizeText('Báo cáo'),
      description: localizeText('Theo dõi nội dung bạn đã báo.'),
      icon: <Flag size={20} />,
    },
  ];

  const tabClassName = (isActive: boolean) =>
    `workspace-nav-item focus-ring relative w-full grid grid-cols-[2.25rem_1fr] items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 text-left transition-[color,background-color,border-color,box-shadow,transform,opacity] ${
      isActive
        ? 'bg-primary/9 text-foreground'
        : 'hover:bg-primary/6 text-muted-foreground hover:text-foreground'
    }`;

  const activeSignal = (surface: 'mobile' | 'desktop') => (
    <motion.span layoutId={`settings-active-${surface}`} className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary" transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }} />
  );

  const mobileNav = (
    <motion.div
      className="flex h-full w-full flex-col bg-background/95 sm:hidden"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.fadeIn}
    >
      <div className="p-4 pb-3">
        <p className="text-xs font-semibold text-primary">{localizeText('Không gian cá nhân')}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight"><BrandWord /></h2>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {navigationItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onTabChange(item.key)}
            className={`${tabClassName(activeTab === item.key)} justify-start`}
            aria-pressed={activeTab === item.key}
          >
            {activeTab === item.key ? activeSignal('mobile') : null}
            <span className="grid h-9 w-9 place-items-center rounded-full border border-border/70 text-primary">{item.icon}</span>
            <span><span className="block text-sm font-semibold leading-tight">{item.label}</span><span className="mt-1 block text-xs font-normal leading-4 text-muted-foreground">{item.description}</span></span>
          </button>
        ))}
      </div>

      <div className="mt-auto border-t border-border/50 p-4">
        <button
          type="button"
          onClick={() => onLogout()}
          className="focus-ring w-full flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground group"
        >
          <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-semibold text-sm">{localizeText('Đăng xuất')}</span>
        </button>
      </div>
    </motion.div>
  );

  return (
    <>
      <motion.div
        className="hidden h-full w-64 shrink-0 flex-col border-r border-border/50 bg-background/30 sm:flex"
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.fadeIn}
      >
        <div className="p-6 pb-4">
          <p className="text-xs font-semibold text-primary">{localizeText('Không gian cá nhân')}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight"><BrandWord /></h2>
        </div>

        <div className="flex-1 px-3 space-y-2">
          {navigationItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={tabClassName(activeTab === item.key)}
              aria-pressed={activeTab === item.key}
            >
              {activeTab === item.key ? activeSignal('desktop') : null}
              <span className="grid h-9 w-9 place-items-center rounded-full border border-border/70 text-primary">{item.icon}</span>
              <span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs font-normal leading-4 text-muted-foreground">{item.description}</span></span>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-border/50 mt-auto">
          <button
            type="button"
            onClick={() => onLogout()}
            className="focus-ring w-full flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground group"
          >
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold text-sm">{localizeText('Đăng xuất')}</span>
          </button>
        </div>
      </motion.div>

      {mobileNav}
    </>
  );
};
