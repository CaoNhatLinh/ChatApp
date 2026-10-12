"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PublicPageShell } from "@/route-pages/shared/PublicPageShell";
import { LandingReveal } from "@/route-pages/shared/landing/LandingReveal";
import { PrivacyPolicyCards } from "@/route-pages/privacy/components/PrivacyPolicyCards";
import { PrivacyPageCta } from "@/route-pages/privacy/components/PrivacyPageCta";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { localizeText, useAppLocale } from "@/shared/i18n";
import { BrandText } from "@/shared/ui/BrandWord";

export const PrivacyPage = () => {
  const { locale } = useAppLocale();

  return (
    <PublicPageShell>
      <div lang={locale}>
        <section className="layout-shell grid gap-12 py-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20 lg:py-20">
          <LandingReveal className="page-intro lg:pt-4">
            <p className="page-kicker">{UI_COPY.privacy.eyebrow}</p>
            <h1 className="max-w-[10ch] text-5xl font-bold leading-[0.96] tracking-[-0.06em] sm:text-6xl">{UI_COPY.privacy.title}</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground"><BrandText text={UI_COPY.privacy.description} /></p>
            <PrivacyPageCta />
          </LandingReveal>
          <LandingReveal className="self-end rounded-[1.2rem] border border-border/80 bg-card/45 p-5 sm:p-7" delay={0.08}><p className="page-kicker mb-2">{localizeText("Tóm tắt dễ kiểm tra")}</p><h2 className="max-w-lg text-2xl font-semibold tracking-[-0.04em]">{UI_COPY.privacy.overviewTitle}</h2><p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{UI_COPY.privacy.overview}</p><Link href="#data-lifecycle" className="focus-ring mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80">{localizeText("Xem vòng đời dữ liệu")} <ArrowRight size={15} aria-hidden="true" /></Link></LandingReveal>
        </section>

        <section id="data-lifecycle" className="section-frame">
          <LandingReveal className="layout-shell grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20"><div className="page-intro"><p className="page-kicker">{localizeText("Theo từng thời điểm")}</p><h2 className="max-w-md text-3xl font-bold tracking-[-0.05em] sm:text-4xl">{localizeText("Dữ liệu chỉ có ý nghĩa trong đúng ngữ cảnh.")}</h2></div><PrivacyPolicyCards /></LandingReveal>
        </section>
      </div>
    </PublicPageShell>
  );
};

export default PrivacyPage;
