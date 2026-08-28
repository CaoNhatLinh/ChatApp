'use client';

import { useEffect } from 'react';
import { localizeText, useAppLocale } from '@/shared/i18n';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useAppLocale();
  useEffect(() => {
    console.error('[NextApp] route rendering failed', error);
  }, [error]);

  return (
    <main className="page-shell flex min-h-[100dvh] items-center justify-center p-6 text-foreground">
      <section className="w-full max-w-xl">
        <img src="/novachat-app-mark.png" alt="" aria-hidden="true" className="h-12 w-12 object-contain" />
        <p className="page-kicker mt-8">NovaChat</p>
        <h1 className="max-w-[12ch] text-5xl font-bold leading-[1.02] tracking-[-0.045em]">{localizeText('Không thể tải khu vực này.')}</h1>
        <p className="mt-5 max-w-md text-lg leading-8 text-muted-foreground">{localizeText('Hãy thử lại. Nếu lỗi tiếp tục, quay về workspace và mở lại cuộc trò chuyện.')}</p>
        <button className="focus-ring mt-8 rounded-[var(--radius-md)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" onClick={() => reset()} type="button">{localizeText('Tải lại')}</button>
      </section>
    </main>
  );
}
