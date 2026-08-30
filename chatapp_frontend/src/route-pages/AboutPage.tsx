"use client";

import { ArrowUpRight, CheckCircle2, Radio, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PublicPageShell } from "@/route-pages/shared/PublicPageShell";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { localizeText, useAppLocale } from "@/shared/i18n";

const valueIcons = [CheckCircle2, Radio, ShieldCheck] as const;

export const AboutPage = () => {
  const { locale } = useAppLocale();

  return (
    <PublicPageShell>
      <section className="layout-shell grid gap-12 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-20" lang={locale}>
        <div className="page-intro lg:pt-4">
          <p className="page-kicker">{localizeText("Về Nối")}</p>
          <h1 className="max-w-[10ch] text-5xl font-bold leading-[0.96] tracking-[-0.055em] sm:text-6xl">{localizeText("Một nơi để cuộc trò chuyện giữ được nhịp của nó.")}</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">{localizeText("Nối kết nối tin nhắn, trạng thái và quyền truy cập trong cùng một không gian để bạn không phải ghép lại ngữ cảnh.")}</p>
          <Link href="/help" className="focus-ring mt-8 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px">{localizeText("Xem hướng dẫn")} <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </div>

        <div className="self-end border-y border-border">
          {UI_COPY.about.values.map((value, index) => {
            const Icon = valueIcons[index];
            return (
              <article key={value.title} className="grid gap-3 border-b border-border py-6 last:border-b-0 sm:grid-cols-[2.75rem_0.75fr_1.25fr] sm:items-start sm:gap-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/12 text-primary"><Icon size={16} aria-hidden="true" /></span>
                <h2 className="text-lg font-semibold tracking-[-0.02em]">{value.title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{value.description}</p>
              </article>
            );
          })}
        </div>
      </section>
    </PublicPageShell>
  );
};

export default AboutPage;
