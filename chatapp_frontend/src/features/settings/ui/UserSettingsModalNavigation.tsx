import { motion } from 'framer-motion';
import { Flag, LogOut, Palette, UserCircle } from 'lucide-react';
import type { FC, ReactNode } from 'react';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import { localizeText } from '@/shared/i18n';

type TabType = 'profile' | 'appearance' | 'reports';

interface UserSettingsModalNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onLogout: () => void;
}

interface NavigationItem {
  key: TabType;
  label: string;
  icon: ReactNode;
}

export const UserSettingsModalNavigation: FC<UserSettingsModalNavigationProps> = ({
  activeTab,
  onTabChange,
  onLogout,
}) => {
  const navigationItems: NavigationItem[] = [
    {
      key: 'profile',
      label: localizeText('Tài khoản & Hồ sơ'),
      icon: <UserCircle size={20} />,
    },
    {
      key: 'appearance',
      label: localizeText('Giao diện'),
      icon: <Palette size={20} />,
    },
    {
      key: 'reports',
      label: localizeText('Báo cáo'),
      icon: <Flag size={20} />,
    },
  ];

  const tabClassName = (isActive: boolean) =>
    `focus-ring w-full flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 transition-[color,background-color,border-color,box-shadow,transform,opacity] ${
      isActive
        ? 'bg-primary text-primary-foreground neo-shadow'
        : 'hover:bg-primary/10 text-muted-foreground hover:text-foreground'
    }`;

  const mobileNav = (
    <motion.div
      className="w-full border-b border-border/50 bg-background/35 sm:hidden"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.fadeIn}
    >
      <div className="p-4 pb-3">
        <h2 className="text-lg font-semibold tracking-tight">{localizeText('Cài đặt')}</h2>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-3">
        {navigationItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onTabChange(item.key)}
            className={tabClassName(activeTab === item.key)}
            aria-pressed={activeTab === item.key}
          >
            {item.icon}
            <span className="font-semibold text-sm leading-tight">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <div className="p-4 pt-3 border-t border-border/50 mt-3">
        <button
          type="button"
          onClick={() => onLogout()}
          className="focus-ring w-full flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground group"
        >
          <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold text-[0.72rem] uppercase tracking-[0.12em]">{localizeText('Đăng xuất')}</span>
        </button>
      </div>
    </motion.div>
  );

  return (
    <>
      <motion.div
        className="w-64 border-r border-border/50 bg-background/30 flex-col hidden sm:flex"
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.fadeIn}
      >
        <div className="p-6 pb-4">
          <h2 className="text-xl font-semibold tracking-tight mb-2">{localizeText('Cài đặt')}</h2>
        </div>

        <div className="flex-1 px-3 space-y-2">
          {navigationItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={tabClassName(activeTab === item.key)}
            >
              {item.icon}
              <span className="font-semibold text-sm">{item.label}</span>
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
