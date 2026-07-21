import { motion } from 'framer-motion';
import { LogOut, Palette, UserCircle } from 'lucide-react';
import type { FC, ReactNode } from 'react';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';

type TabType = 'profile' | 'appearance';

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
      label: 'Tài khoản & Hồ sơ',
      icon: <UserCircle size={20} />,
    },
    {
      key: 'appearance',
      label: 'Giao diện',
      icon: <Palette size={20} />,
    },
  ];

  const tabClassName = (isActive: boolean) =>
    `w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
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
        <h2 className="text-lg font-black uppercase tracking-tight">Cài đặt</h2>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4">
        {navigationItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onTabChange(item.key)}
            className={tabClassName(activeTab === item.key)}
            aria-pressed={activeTab === item.key}
          >
            {item.icon}
            <span className="font-bold text-[0.72rem] uppercase tracking-[0.12em] leading-tight">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <div className="p-4 pt-3 border-t border-border/50 mt-3">
        <button
          type="button"
          onClick={() => onLogout()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-destructive text-destructive hover:text-destructive-foreground transition-all neo-shadow active:scale-95 group"
        >
          <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold text-[0.72rem] uppercase tracking-[0.12em]">Đăng xuất</span>
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
          <h2 className="text-xl font-black uppercase tracking-tight mb-2">Cài đặt</h2>
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
              <span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-border/50 mt-auto">
          <button
            type="button"
            onClick={() => onLogout()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-destructive text-destructive hover:text-destructive-foreground transition-all neo-shadow active:scale-95 group"
          >
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold text-sm uppercase tracking-widest">Đăng xuất</span>
          </button>
        </div>
      </motion.div>

      {mobileNav}
    </>
  );
};
