import { useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, X } from 'lucide-react';
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
import { UserSettingsLanguagePanel } from './UserSettingsLanguagePanel';
import { UserSettingsModalNavigation } from './UserSettingsModalNavigation';
import { UserSettingsProfilePanel } from './UserSettingsProfilePanel';
import { Button } from '@/shared/ui/Button';
import { ReportHistoryPanel } from '@/features/moderation/components/ReportHistoryPanel';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { NotificationSettingsPanel } from '@/features/notifications/components/NotificationSettingsPanel';
import { logger } from '@/shared/lib/logger';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { cn } from '@/shared/lib/cn';
import { ModalShell } from '@/shared/ui/ModalShell';
import { ConnectedAccountsPanel } from './ConnectedAccountsPanel';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'profile' | 'connections' | 'appearance' | 'language' | 'notifications' | 'reports';
  mode?: 'modal' | 'page';
}

type TabType = 'profile' | 'connections' | 'appearance' | 'language' | 'notifications' | 'reports';
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
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [draftThemePreference, setDraftThemePreference] = useState<ThemePreference>('system');
  const [savedThemePreference, setSavedThemePreference] = useState<ThemePreference>('system');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const appearanceOpenRef = useRef(false);

  const { user, logout: logoutStore, updateUser } = useAuthStore();
  const { themePreference, setThemePreference, previewThemePreference } = useTheme();
  const { locale, setLocale } = useAppLocale();
  const router = useRouter();

  const isPageMode = mode === 'page';
  const isWorking = isSaving || isLoggingOut;

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setAvatarUrl(user.avatarUrl ?? '');
  }, [user, user?.userId, user?.displayName, user?.avatarUrl, isOpen]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (isOpen) {
      setMobileNavOpen(!isPageMode);
    }
  }, [isOpen, isPageMode]);

  useEffect(() => {
    if (isOpen && !appearanceOpenRef.current) {
      const currentTheme = themePreference as ThemePreference;
      setDraftThemePreference(currentTheme);
      setSavedThemePreference(currentTheme);
    }
    appearanceOpenRef.current = isOpen;
  }, [isOpen, themePreference]);

  const normalizedDisplayName = useMemo(() => displayName.trim(), [displayName]);
  const currentDisplayName = useMemo(() => user?.displayName.trim() ?? '', [user?.displayName]);
  const isProfileUnchanged = useMemo(
    () =>
      normalizedDisplayName === currentDisplayName &&
      avatarUrl === (user?.avatarUrl ?? ''),
    [
      avatarUrl,
      currentDisplayName,
      normalizedDisplayName,
      user?.avatarUrl,
    ]
  );

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
      if (draftThemePreference !== savedThemePreference) {
        previewThemePreference(savedThemePreference);
      }
      onClose();
    }
  };

  const handleThemePreview = (nextTheme: ThemePreference) => {
    setDraftThemePreference(nextTheme);
    previewThemePreference(nextTheme);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  const handleSaveAppearance = () => {
    if (draftThemePreference === savedThemePreference) {
      notifyWarning(UI_COPY.settings.saveProfileNoChanges);
      return;
    }
    setThemePreference(draftThemePreference);
    setSavedThemePreference(draftThemePreference);
  };

  if (!isOpen) {
    return null;
  }

  const content = (
    <motion.div
      className={
        isPageMode
          ? 'settings-surface relative flex h-full min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border/60'
          : 'settings-surface relative flex h-full min-h-0 w-full flex-col overflow-hidden'
      }
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={isPageMode ? UI_MOTION_VARIANTS.fadeIn : UI_MOTION_VARIANTS.zoomReveal}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClose}
        className="absolute right-3 top-3 z-30 sm:hidden"
        aria-label={localizeText('Đóng cài đặt')}
        disabled={isWorking}
      >
        <X size={22} />
      </Button>

      <div className="relative flex min-h-0 flex-1 flex-col sm:flex-row">
        <div
          className={cn(
            'absolute inset-0 z-20 sm:static sm:z-auto sm:flex sm:w-64 sm:shrink-0',
            mobileNavOpen ? 'block' : 'hidden sm:flex',
          )}
        >
          <UserSettingsModalNavigation
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onLogout={handleLogout}
          />
        </div>

        <div
          className={cn(
            'relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden',
            mobileNavOpen && 'pointer-events-none invisible sm:pointer-events-auto sm:visible',
          )}
        >
          <div className="sticky top-0 z-10 flex h-16 items-center gap-2 border-b border-border/60 bg-card/70 px-4 backdrop-blur-xl sm:px-6">
            {!mobileNavOpen ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileNavOpen(true)}
                className="sm:hidden"
                aria-label={localizeText('Quay lại')}
              >
                <ChevronLeft size={22} />
              </Button>
            ) : null}
            <h2 id="user-settings-title" className="text-lg font-semibold tracking-tight">
              {activeTab === 'profile' ? UI_COPY.settings.profileTitle : activeTab === 'connections' ? localizeText('Cách đăng nhập') : activeTab === 'appearance' ? localizeText('Giao diện') : activeTab === 'language' ? localizeText('Ngôn ngữ') : activeTab === 'notifications' ? localizeText('Thông báo') : localizeText('Báo cáo của tôi')}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="ml-auto hidden sm:inline-flex"
              aria-label={localizeText('Đóng cài đặt')}
              disabled={isWorking}
            >
              <X size={24} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
            <div className="mx-auto max-w-xl">
              {activeTab === 'profile' ? (
                user ? <UserSettingsProfilePanel
                  userName={user.userName}
                  displayName={displayName}
                  avatarUrl={avatarUrl}
                  isSaving={isSaving}
                  canSave={!isProfileUnchanged}
                  onDisplayNameChange={setDisplayName}
                  onAvatarChange={setAvatarUrl}
                  onSave={handleSaveProfile}
                /> : null
              ) : activeTab === 'connections' ? (
                <ConnectedAccountsPanel />
              ) : activeTab === 'appearance' ? (
                <UserSettingsAppearancePanel
                  themePreference={draftThemePreference}
                  onThemeChange={handleThemePreview}
                  canSave={draftThemePreference !== savedThemePreference}
                  onSave={handleSaveAppearance}
                />
              ) : activeTab === 'language' ? (
                <UserSettingsLanguagePanel locale={locale} onLocaleChange={setLocale} />
              ) : activeTab === 'notifications' ? <NotificationSettingsPanel /> : <ReportHistoryPanel />}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (isPageMode) {
    return <div className="w-full">{content}</div>;
  }

  return (
    <ModalShell
      open={isOpen}
      onClose={handleClose}
      closeDisabled={isWorking}
      showClose={false}
      title={localizeText('Cài đặt')}
      description={localizeText('Quản lý hồ sơ, giao diện, ngôn ngữ và thông báo.')}
      className="overflow-hidden sm:h-[85vh] sm:max-h-[850px] sm:max-w-5xl"
    >
      {content}
    </ModalShell>
  );
};

export default UserSettingsModal;

