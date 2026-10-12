'use client';

import Link from 'next/link';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { Button } from '@/shared/ui/Button';
import { localizeText, useAppLocale } from '@/shared/i18n';

export function AuthSessionRecovery() {
  useAppLocale();
  const retry = useAuthStore((state) => state.initializeAuth);
  const loading = useAuthStore((state) => state.loading);

  return (
    <main className="page-shell flex min-h-[100dvh] items-center justify-center px-6">
      <section aria-labelledby="session-recovery-title" className="w-full max-w-md space-y-5">
        <h1 id="session-recovery-title" className="text-2xl font-semibold text-foreground">
          {localizeText('Chưa kiểm tra được phiên đăng nhập')}
        </h1>
        <p role="status" className="text-sm leading-6 text-muted-foreground">
          {localizeText('Kết nối đang gián đoạn. Thử lại để tiếp tục.')}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button loading={loading} onClick={() => void retry()}>{localizeText('Thử lại')}</Button>
          <Button asChild variant="outline"><Link href="/help">{localizeText('Trợ giúp')}</Link></Button>
        </div>
      </section>
    </main>
  );
}
