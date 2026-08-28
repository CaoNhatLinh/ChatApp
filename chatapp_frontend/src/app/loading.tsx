'use client';

import { localizeText, useAppLocale } from '@/shared/i18n';

export default function Loading() {
  useAppLocale();
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background text-foreground" aria-live="polite">
      <img src="/novachat-app-mark.png" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
      <p className="text-sm font-semibold text-muted-foreground">{localizeText('Đang tải NovaChat…')}</p>
    </main>
  );
}
