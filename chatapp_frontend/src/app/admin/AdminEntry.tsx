'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { useAuthStore } from '@/features/auth/model/auth.store';
import AdminPage from '@/route-pages/AdminPage';
import { useAppLocale } from '@/shared/i18n';
import { DeviceLifecycleManager } from '@/features/devices/ui/DeviceLifecycleManager';
import { AppToaster } from '@/shared/ui/AppToaster';
import { AuthSessionRecovery } from '@/features/auth/ui/AuthSessionRecovery';
import { SystemSettingsExitBoundary } from '@/features/settings/ui/SystemSettingsExitBoundary';

export default function AdminEntry() {
  const router = useRouter();
  const { locale } = useAppLocale();
  const { user, token, loading, initializationError, initializeAuth } = useAuthStore();

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (!loading && !initializationError && (!token || !user)) {
      router.replace('/login');
    }
  }, [initializationError, loading, router, token, user]);

  if (initializationError) {
    return <ThemeProvider><AuthSessionRecovery /></ThemeProvider>;
  }

  if (loading || !token || !user) {
    return <div className="page-shell flex min-h-[100dvh] items-center justify-center p-6"><div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground"><img src="/noi-mark.svg" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />{locale === 'vi' ? 'Đang kiểm tra phiên quản trị...' : 'Checking admin session...'}</div></div>;
  }

  return (
      <ThemeProvider>
        <AuthProvider>
          <AppToaster />
          <DeviceLifecycleManager />
          <SystemSettingsExitBoundary onExit={() => router.push('/app')}>
            {requestExit => <AdminPage onBackToApp={requestExit} />}
          </SystemSettingsExitBoundary>
        </AuthProvider>
      </ThemeProvider>
  );
}
