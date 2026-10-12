"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { PublicPageShell } from "@/route-pages/shared/PublicPageShell";
import { LandingReveal } from "@/route-pages/shared/landing/LandingReveal";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { useAppLocale, localizeText } from "@/shared/i18n";
import { BrandWord } from "@/shared/ui/BrandWord";

export const TermsPage = () => {
  const { locale } = useAppLocale();

  return (
    <PublicPageShell>
      <article className="layout-shell max-w-5xl py-12 lg:py-20" lang={locale}>
        <LandingReveal className="grid gap-10 border-b border-border pb-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div><p className="page-kicker"><BrandWord /></p><h1 className="mt-3 max-w-[10ch] text-5xl font-bold leading-[0.96] tracking-[-0.06em] sm:text-6xl">{UI_COPY.terms.title}</h1></div>
          <div className="self-end"><p className="max-w-2xl text-lg leading-8 text-muted-foreground">{UI_COPY.terms.description}</p><div className="mt-6 flex flex-wrap gap-3 text-sm"><Link href="/privacy" className="focus-ring inline-flex items-center gap-2 font-semibold text-primary hover:text-primary/80">{localizeText("Đọc chính sách quyền riêng tư")} <ArrowRight size={15} aria-hidden="true" /></Link><Link href="/help" className="focus-ring inline-flex items-center gap-2 font-semibold text-muted-foreground hover:text-foreground">{localizeText("Cần trợ giúp?")} <ArrowRight size={15} aria-hidden="true" /></Link></div></div>
        </LandingReveal>

        <LandingReveal><section className="grid gap-8 border-b border-border py-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20" aria-labelledby="terms-summary-title"><div><p className="page-kicker mb-2">{localizeText("Điều quan trọng nhất")}</p><h2 id="terms-summary-title" className="text-2xl font-semibold tracking-[-0.04em]">{UI_COPY.terms.summaryTitle}</h2></div><ul className="grid gap-3 sm:grid-cols-2" role="list">{UI_COPY.terms.summary.map((item) => <li key={item} className="flex items-start gap-3 rounded-[0.9rem] border border-border/80 bg-card/45 p-4 text-sm leading-6 text-muted-foreground"><Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{item}</li>)}</ul></section></LandingReveal>

        <LandingReveal className="terms-disclosure-list">{UI_COPY.terms.items.map((section, index) => <details key={section.title} className="terms-disclosure" open={index === 0}><summary className="focus-ring"><span>0{index + 1}</span><h2>{section.title}</h2><i aria-hidden="true" /></summary><div className="terms-disclosure-body"><p>{section.body}</p></div></details>)}</LandingReveal>
      </article>
    </PublicPageShell>
  );
};

export default TermsPage;
