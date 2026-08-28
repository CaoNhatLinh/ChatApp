'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body className="bg-background text-foreground">
        <main className="flex min-h-[100dvh] items-center justify-center px-6 py-12">
          <section className="w-full max-w-xl">
            <span className="brand-mark" aria-hidden="true">N</span>
            <p className="page-kicker mt-8 text-primary">Lỗi hệ thống</p>
            <h1 className="max-w-[12ch] text-5xl font-bold leading-[1.02] tracking-[-0.045em]">Ứng dụng cần được tải lại.</h1>
            <p className="mt-5 max-w-md text-lg leading-8 text-muted-foreground">Dữ liệu đã gửi vẫn được máy chủ xử lý theo hợp đồng. Hãy thử lại sau ít phút.</p>
            <button type="button" onClick={() => reset()} className="focus-ring mt-8 rounded-[var(--radius-md)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Tải lại</button>
          </section>
        </main>
      </body>
    </html>
  );
}
