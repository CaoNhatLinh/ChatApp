import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page-shell flex min-h-[100dvh] items-center justify-center px-6 py-12 text-foreground">
      <section className="w-full max-w-xl">
        <span className="brand-mark" aria-hidden="true">N</span>
        <p className="page-kicker mt-8">Lỗi 404</p>
        <h1 className="max-w-[10ch] text-5xl font-bold leading-[1.02] tracking-[-0.045em] sm:text-6xl">Trang này không còn ở đây.</h1>
        <p className="mt-5 max-w-md text-lg leading-8 text-muted-foreground">Đường dẫn có thể đã thay đổi. Bạn có thể quay về trang chính hoặc mở workspace.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="focus-ring rounded-[var(--radius-md)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" href="/">Về trang chính</Link>
          <Link className="focus-ring rounded-[var(--radius-md)] border border-border px-5 py-3 text-sm font-semibold hover:border-primary hover:text-primary" href="/app">Mở workspace</Link>
        </div>
      </section>
    </main>
  );
}
