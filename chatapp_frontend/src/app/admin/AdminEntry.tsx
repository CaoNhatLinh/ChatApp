'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { useAuthStore } from '@/features/auth/model/auth.store';
import AdminPage from '@/route-pages/AdminPage';
import { AppI18nProvider } from '@/shared/i18n';

export default function AdminEntry() {
  const router = useRouter();
  const { user, token, loading, initializeAuth } = useAuthStore();

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (!loading && (!token || !user)) {
      router.replace('/login');
    }
  }, [loading, router, token, user]);

  if (loading || !token || !user) {
    return <AppI18nProvider><div className="page-shell flex min-h-[100dvh] items-center justify-center p-6"><div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground"><img src="/novachat-app-mark.png" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />Đang kiểm tra phiên quản trị...</div></div></AppI18nProvider>;
  }

  return (
    <AppI18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <Toaster position="top-center" />
          <AdminPage onBackToApp={() => router.push('/app')} />
        </AuthProvider>
      </ThemeProvider>
    </AppI18nProvider>
  );
}
