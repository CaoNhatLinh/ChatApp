'use client';

import { getLocale, localizeText } from '@/shared/i18n';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang={getLocale()}>
      <body className="bg-background text-foreground">
        <main className="flex min-h-[100dvh] items-center justify-center px-6 py-12">
          <section className="w-full max-w-xl">
            <img src="/novachat-app-mark.png" alt="" aria-hidden="true" className="h-12 w-12 object-contain" />
            <p className="page-kicker mt-8 text-primary">{localizeText('Lỗi hệ thống')}</p>
            <h1 className="max-w-[12ch] text-5xl font-bold leading-[1.02] tracking-[-0.045em]">{localizeText('Ứng dụng cần được tải lại.')}</h1>
            <p className="mt-5 max-w-md text-lg leading-8 text-muted-foreground">{localizeText('Dữ liệu đã gửi vẫn được máy chủ xử lý theo hợp đồng. Hãy thử lại sau ít phút.')}</p>
            <button type="button" onClick={() => reset()} className="focus-ring mt-8 rounded-[var(--radius-md)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">{localizeText('Tải lại')}</button>
          </section>
        </main>
      </body>
    </html>
  );
}
