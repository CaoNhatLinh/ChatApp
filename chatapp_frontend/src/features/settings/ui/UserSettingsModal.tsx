import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
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
import { ReportHistoryPanel } from '@/features/moderation/components/ReportHistoryPanel';
import { localizeText } from '@/shared/i18n';
import { NotificationSettingsPanel } from '@/features/notifications/components/NotificationSettingsPanel';
import { logger } from '@/shared/lib/logger';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'profile' | 'appearance' | 'notifications' | 'reports';
  mode?: 'modal' | 'page';
}

type TabType = 'profile' | 'appearance' | 'notifications' | 'reports';
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
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setAvatarUrl(user.avatarUrl ?? '');
    setNickname(user.nickName ?? '');
  }, [user, user?.userId, user?.displayName, user?.avatarUrl, user?.nickName, isOpen]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const normalizedDisplayName = useMemo(() => displayName.trim(), [displayName]);
  const currentDisplayName = useMemo(() => user?.displayName.trim() ?? '', [user?.displayName]);
  const isProfileUnchanged = useMemo(
    () =>
      normalizedDisplayName === currentDisplayName &&
      avatarUrl === (user?.avatarUrl ?? '') &&
      nickname === (user?.nickName ?? ''),
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
      logger.error('[UserSettingsModal] Failed to update profile', error instanceof Error ? error.message : String(error));
      notifyError(getUserFacingErrorMessage(error, UI_COPY.settings.saveProfileError));
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
        logger.warn('[UserSettingsModal] Failed to send explicit logout', error instanceof Error ? error.message : String(error));
      }

      await logout();
      notifySuccess(UI_COPY.settings.logoutSuccess);
    } catch (error: unknown) {
      logger.error('[UserSettingsModal] Logout failed', error instanceof Error ? error.message : String(error));
      notifyWarning(UI_COPY.settings.logoutWarning);
      notifyError(getUserFacingErrorMessage(error, UI_COPY.settings.logoutError));
    } finally {
      disconnectWebSocket();
      logoutStore();
      router.replace('/login');
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
          ? 'relative flex h-full min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card'
          : 'relative z-10 flex h-[85vh] max-h-[850px] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card sm:flex-row'
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
        <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background px-6">
          <h2 className="hidden text-lg font-semibold tracking-tight sm:block">
            {activeTab === 'profile' ? UI_COPY.settings.profileTitle : activeTab === 'appearance' ? localizeText('Giao diện') : activeTab === 'notifications' ? localizeText('Thông báo') : localizeText('Báo cáo của tôi')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="ml-auto"
            aria-label={localizeText('Đóng cài đặt')}
            disabled={isWorking}
          >
            <X size={24} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
          <div className="max-w-xl mx-auto">
            {activeTab === 'profile' ? (
              user ? <UserSettingsProfilePanel
                userName={user.userName}
                displayName={displayName}
                avatarUrl={avatarUrl}
                nickname={nickname}
                isSaving={isSaving}
                canSave={!isProfileUnchanged}
                onDisplayNameChange={setDisplayName}
                onAvatarChange={setAvatarUrl}
                onNicknameChange={setNickname}
                onSave={handleSaveProfile}
              /> : null
            ) : activeTab === 'appearance' ? (
              <UserSettingsAppearancePanel
                themePreference={themePreference as ThemePreference}
                onThemeChange={setThemePreference}
              />
            ) : activeTab === 'notifications' ? <NotificationSettingsPanel /> : <ReportHistoryPanel />}
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

