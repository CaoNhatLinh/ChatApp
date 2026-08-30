'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { PresenceManager } from '@/app/providers/PresenceManager';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { AppI18nProvider, localizeText } from '@/shared/i18n';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { DeviceLifecycleManager } from '@/features/devices/ui/DeviceLifecycleManager';
import { NetworkStatusBanner } from '@/shared/ui/NetworkStatusBanner';
import { AppToaster } from '@/shared/ui/AppToaster';
import { useEffect, useState } from 'react';

interface NativeRouteShellProps {
  children: ReactNode;
  sessionAware?: boolean;
}

export function NativeRouteShell({ children, sessionAware = false }: NativeRouteShellProps) {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (sessionAware) {
      void initializeAuth();
    }
  }, [initializeAuth, sessionAware]);

  return (
    <AppI18nProvider>
      {!mounted ? (
        <div className="page-shell flex min-h-[100dvh] items-center justify-center p-6" aria-busy="true" aria-label={localizeText('Đang khởi tạo Nối')}>
          <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
            <img src="/noi-mark.svg" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
            {localizeText('Đang khởi tạo Nối')}
          </div>
        </div>
      ) : (
        <ThemeProvider>
          <AuthProvider>
            <PresenceManager />
            <DeviceLifecycleManager />
            <NetworkStatusBanner />
            <AppToaster />
            {children}
          </AuthProvider>
        </ThemeProvider>
      )}
    </AppI18nProvider>
  );
}

export default NativeRouteShell;
