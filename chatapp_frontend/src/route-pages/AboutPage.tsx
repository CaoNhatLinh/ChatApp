"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, MessageCircle, Radio, Users } from "lucide-react";
import { useState } from "react";
import { PublicPageShell } from "@/route-pages/shared/PublicPageShell";
import { LandingReveal } from "@/route-pages/shared/landing/LandingReveal";
import { SignalThread } from "@/route-pages/shared/landing/SignalThread";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { localizeText, useAppLocale } from "@/shared/i18n";
import { BrandText } from "@/shared/ui/BrandWord";

const principleIcons = [MessageCircle, Users, Radio] as const;

export const AboutPage = () => {
  const { locale } = useAppLocale();
  const [activePrinciple, setActivePrinciple] = useState(0);

  return (
    <PublicPageShell>
      <div lang={locale} className="overflow-hidden">
        <section className="about-poster">
          <div className="layout-shell relative min-h-[min(850px,calc(100dvh-4rem))] py-16 sm:py-24">
            <p className="relay-kicker">{localizeText("Tuyên ngôn của Nối")}</p>
            <h1 className="about-poster-title">{UI_COPY.about.title}</h1>
            <div className="about-orbit-art">
              <Image src="/noi-signal-orbit.svg" alt="" fill priority sizes="(max-width: 768px) 100vw, 60vw" className="object-contain" />
            </div>
            <div className="about-poster-copy"><p><BrandText text={UI_COPY.about.description} /></p><div className="mt-7 flex flex-wrap gap-3"><Link href="/app" className="landing-button landing-button-primary focus-ring"><span className="landing-button-label">{localizeText("Bước vào Nối")}</span><ArrowRight className="landing-button-icon" size={17} aria-hidden="true" /></Link><Link href="/help" className="landing-button landing-button-secondary-light focus-ring"><span className="landing-button-label">{localizeText("Tìm một lối đi")}</span></Link></div></div>
            <a href="#principles" className="focus-ring about-poster-cue">{localizeText("Ba quyết định nền")}</a>
          </div>
        </section>

        <section id="principles" className="about-principles">
          <div className="layout-shell relative py-24 sm:py-36">
            <SignalThread variant="wave" className="text-landing-on-ink absolute left-[-18%] top-20 h-64 w-[136%]" />
            <p className="relay-kicker text-primary">{localizeText("Cách Nối giữ nhịp")}</p>
            <LandingReveal className="about-principle-stack">
              {UI_COPY.about.principles.map((principle, index) => {
                const Icon = principleIcons[index];
                return <article key={principle.title} className={`about-principle about-principle-${index + 1}`} data-active={activePrinciple === index || undefined}><button type="button" className="about-principle-control focus-ring" aria-pressed={activePrinciple === index} onClick={() => setActivePrinciple(index)}><span className="about-principle-index">0{index + 1}</span><Icon size={22} aria-hidden="true" /><h2>{principle.title}</h2><p>{principle.description}</p><span className="about-principle-action">{localizeText("Chọn để giữ tín hiệu này ở gần")}</span></button></article>;
              })}
            </LandingReveal>
          </div>
        </section>

        <section className="about-flow">
          <div className="layout-shell py-24 sm:py-32">
            <LandingReveal className="grid gap-12 lg:grid-cols-[0.38fr_0.62fr]">
              <div><p className="relay-kicker text-primary">{localizeText("Một cuộc trò chuyện")}</p><h2>{UI_COPY.about.flowTitle}</h2></div>
              <ol className="about-flow-list" aria-label={localizeText("Các bước kết nối")}>
                {UI_COPY.about.flow.map((step, index) => <li key={step.title}><span>0{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div><ArrowDownRight aria-hidden="true" /></li>)}
              </ol>
            </LandingReveal>
          </div>
        </section>

        <section className="about-boundary">
          <div className="layout-shell relative py-24 sm:py-36">
            <p className="relay-kicker text-primary">{localizeText("Ranh giới là một phần của thiết kế")}</p>
            <LandingReveal><h2>{UI_COPY.about.boundaryTitle}</h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-[0.62fr_0.38fr] sm:items-end"><p>{UI_COPY.about.boundary}</p><Link href="/privacy" className="about-boundary-link focus-ring group inline-flex items-center justify-between border-b pb-3 text-sm font-semibold text-primary">{localizeText("Dữ liệu đi qua Nối thế nào")}<ArrowRight className="transition-transform group-hover:translate-x-1" size={17} aria-hidden="true" /></Link></div>
            </LandingReveal>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
};

export default AboutPage;
