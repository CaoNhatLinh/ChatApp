import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { FC } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { logout } from '@/features/auth/api/auth.api';
import { updateProfile } from '@/features/profile/api/users.api';
import { presenceWsService } from '@/features/presence/services/presenceWsService';
import { disconnectWebSocket } from '@/shared/websocket/websocketService';
import { UI_COPY } from '@/shared/constants/ui-copy';
import { notifyError, notifySuccess, notifyWarning } from '@/shared/lib/notification';
import { useTheme } from '@/app/providers/theme';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import { UserSettingsAppearancePanel } from './UserSettingsAppearancePanel';
import { UserSettingsModalNavigation } from './UserSettingsModalNavigation';
import { UserSettingsProfilePanel } from './UserSettingsProfilePanel';
import { Button } from '@/shared/ui/Button';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'profile' | 'appearance';
  mode?: 'modal' | 'page';
}

type TabType = 'profile' | 'appearance';
type ThemePreference = 'light' | 'dark' | 'system';

export const UserSettingsModal: FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'profile',
  mode = 'modal',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [nickname, setNickname] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { user, logout: logoutStore, updateUser } = useAuthStore();
  const { themePreference, setThemePreference } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName || '');
    setAvatarUrl(user.avatarUrl || '');
    setNickname(user.nickName || '');
  }, [user, user?.userId, user?.displayName, user?.avatarUrl, user?.nickName, isOpen]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const normalizedDisplayName = useMemo(() => displayName.trim(), [displayName]);
  const currentDisplayName = useMemo(() => (user?.displayName || '').trim(), [user?.displayName]);
  const isProfileUnchanged = useMemo(
    () =>
      normalizedDisplayName === currentDisplayName &&
      avatarUrl === (user?.avatarUrl || '') &&
      nickname === (user?.nickName || ''),
    [
      avatarUrl,
      currentDisplayName,
      normalizedDisplayName,
      nickname,
      user?.avatarUrl,
      user?.nickName,
    ]
  );

  if (!isOpen) {
    return null;
  }

  const isPageMode = mode === 'page';
  const isWorking = isSaving || isLoggingOut;

  const handleSaveProfile = async () => {
    if (!normalizedDisplayName) {
      notifyError(UI_COPY.settings.saveProfileEmptyName);
      return;
    }

    if (isProfileUnchanged) {
      notifyWarning(UI_COPY.settings.saveProfileNoChanges);
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser = await updateProfile({
        displayName: normalizedDisplayName,
        avatarUrl,
        nickname,
      });
      updateUser(updatedUser);
      notifySuccess(UI_COPY.settings.saveProfileSuccess);
    } catch (error: unknown) {
      console.error('Failed to update profile', error);
      notifyError(UI_COPY.settings.saveProfileError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      try {
        presenceWsService.sendLogout();
      } catch (error: unknown) {
        console.warn('Failed to send explicit logout', error);
      }

      await logout();
      notifySuccess(UI_COPY.settings.logoutSuccess);
    } catch (error: unknown) {
      console.error('Logout failed', error);
      notifyWarning(UI_COPY.settings.logoutWarning);
      notifyError(UI_COPY.settings.logoutError);
    } finally {
      disconnectWebSocket();
      logoutStore();
      void navigate('/login');
      onClose();
      setIsLoggingOut(false);
    }
  };

  const handleClose = () => {
    if (!isWorking) {
      onClose();
    }
  };

  const content = (
    <motion.div
      className={
        isPageMode
          ? 'relative w-full max-w-5xl h-full min-h-0 sm:min-h-[560px] bg-card/70 rounded-none sm:rounded-[2rem] border border-border/60 overflow-hidden flex flex-col'
          : 'relative w-full max-w-4xl h-[85vh] max-h-[850px] bg-card/60 rounded-[2.5rem] border border-border/60 flex flex-col sm:flex-row overflow-hidden z-10'
      }
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={isPageMode ? UI_MOTION_VARIANTS.fadeIn : UI_MOTION_VARIANTS.zoomReveal}
    >
      <UserSettingsModalNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-16 flex items-center justify-between px-6 border-b border-border/50 bg-background/30 sticky top-0 z-10">
          <h3 className="text-lg font-black uppercase tracking-tight hidden sm:block">
            {activeTab === 'profile' ? UI_COPY.settings.profileTitle : 'Giao diện'}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="ml-auto"
            aria-label="Close settings"
            disabled={isWorking}
          >
            <X size={24} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
          <div className="max-w-xl mx-auto">
            {activeTab === 'profile' ? (
              <UserSettingsProfilePanel
                userName={user?.userName || ''}
                displayName={displayName}
                avatarUrl={avatarUrl}
                nickname={nickname}
                isSaving={isSaving}
                canSave={!isProfileUnchanged}
                onDisplayNameChange={setDisplayName}
                onAvatarChange={setAvatarUrl}
                onNicknameChange={setNickname}
                onSave={handleSaveProfile}
              />
            ) : (
              <UserSettingsAppearancePanel
                themePreference={themePreference as ThemePreference}
                onThemeChange={setThemePreference}
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (isPageMode) {
    return <div className="w-full">{content}</div>;
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-background/40 backdrop-blur-md"
        onClick={handleClose}
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.fadeIn}
      />
      {content}
    </div>,
    document.body
  );
};

export default UserSettingsModal;

