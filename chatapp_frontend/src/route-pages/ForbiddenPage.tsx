import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { localizeText, useAppLocale } from '@/shared/i18n';

export const ForbiddenPage = () => {
  const router = useRouter();
  const { locale } = useAppLocale();

  return (
    <main className="page-shell flex min-h-[100dvh] items-center justify-center px-6 py-12 text-foreground" lang={locale}>
      <section className="w-full max-w-xl" aria-labelledby="forbidden-title">
        <div className="brand-mark bg-destructive text-destructive-foreground">
          <ShieldAlert size={30} aria-hidden="true" />
        </div>
        <p className="page-kicker mt-8 text-destructive">403</p>
        <h1 id="forbidden-title" className="max-w-[12ch] text-5xl font-bold leading-[1.02] tracking-[-0.045em] sm:text-6xl">{localizeText('Khu vực này không dành cho tài khoản hiện tại.')}</h1>
        <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">{localizeText('Quyền ứng dụng được kiểm tra ở máy chủ. Hãy quay lại workspace hoặc đăng nhập bằng tài khoản phù hợp.')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={() => router.back()} className="focus-ring inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary">
            <ArrowLeft size={16} aria-hidden="true" /> {localizeText('Quay lại')}
          </button>
          <button type="button" onClick={() => router.push('/app')} className="focus-ring rounded-[var(--radius-md)] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px">{localizeText('Về workspace')}</button>
        </div>
      </section>
    </main>
  );
};

export default ForbiddenPage;
