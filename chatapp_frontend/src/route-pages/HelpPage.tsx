"use client";

import { ArrowDownRight, ArrowUpRight, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { PublicPageShell } from "@/route-pages/shared/PublicPageShell";
import { HelpFaqList } from "@/route-pages/help/components/HelpFaqList";
import { HelpTipCards } from "@/route-pages/help/components/HelpTipCards";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { localizeText, useAppLocale } from "@/shared/i18n";

export const HelpPage = () => {
  const { locale } = useAppLocale();

  return (
    <PublicPageShell>
      <section className="layout-shell grid gap-10 py-12 lg:grid-cols-[0.84fr_1.16fr] lg:gap-20 lg:py-20" lang={locale}>
        <div className="page-intro lg:pt-4">
          <p className="page-kicker">{UI_COPY.help.eyebrow}</p>
          <h1 className="max-w-[10ch] text-5xl font-bold leading-[0.96] tracking-[-0.055em] sm:text-6xl">{localizeText("Luôn có lối để quay lại cuộc trò chuyện.")}</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">{localizeText("Tìm câu trả lời ngắn, bắt đầu lại trong vài bước, hoặc mở Nối khi bạn đã sẵn sàng.")}</p>
          <Link href="/app" className="focus-ring mt-8 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px">
            {UI_COPY.help.quickStartButton}<ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>

        <aside className="self-end border-t border-border pt-5" aria-label={localizeText("Điều hướng hỗ trợ nhanh")}>
          <div className="flex items-start justify-between gap-5">
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">{localizeText("Mỗi câu trả lời chỉ dẫn đến một thao tác tiếp theo. Phần chi tiết chỉ mở khi bạn cần.")}</p>
            <span className="brand-mark h-9 w-9 shrink-0 rounded-[0.65rem]"><LifeBuoy size={17} aria-hidden="true" /></span>
          </div>
          <div className="mt-8 grid gap-2 sm:grid-cols-2">
            <a className="focus-ring group flex items-center justify-between rounded-[var(--radius-md)] border border-border px-4 py-3 text-sm font-semibold transition-colors hover:border-primary hover:text-primary" href="#faq-title">
              {UI_COPY.help.faqTitle}<ArrowDownRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <a className="focus-ring group flex items-center justify-between rounded-[var(--radius-md)] border border-border px-4 py-3 text-sm font-semibold transition-colors hover:border-primary hover:text-primary" href="#tips-title">
              {UI_COPY.help.tipsTitle}<ArrowDownRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </div>
        </aside>
      </section>

      <section className="section-frame border-t border-border/70 py-12 lg:py-16">
        <div className="layout-shell grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-20">
          <section aria-labelledby="faq-title">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary">01</span>
              <h2 id="faq-title" className="text-2xl font-semibold tracking-[-0.03em]">{UI_COPY.help.faqTitle}</h2>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{localizeText("Mở đúng câu hỏi để xem hướng dẫn, không cần đọc toàn bộ trang.")}</p>
            <div className="mt-6"><HelpFaqList /></div>
          </section>

          <aside className="self-start lg:pt-1" aria-labelledby="tips-title">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary">02</span>
              <h2 id="tips-title" className="text-2xl font-semibold tracking-[-0.03em]">{UI_COPY.help.tipsTitle}</h2>
            </div>
            <div className="mt-5"><HelpTipCards /></div>
            <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">{UI_COPY.help.supportLine}</p>
          </aside>
        </div>
      </section>
    </PublicPageShell>
  );
};

export default HelpPage;
