"use client";

import Link from "next/link";
import { ArrowRight, LogIn, MessageCircle, UserPlus } from "lucide-react";
import { PublicPageShell } from "@/route-pages/shared/PublicPageShell";
import { LandingReveal } from "@/route-pages/shared/landing/LandingReveal";
import { HelpFaqList } from "@/route-pages/help/components/HelpFaqList";
import { HelpTipCards } from "@/route-pages/help/components/HelpTipCards";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { localizeText, useAppLocale } from "@/shared/i18n";
import { BrandText } from "@/shared/ui/BrandWord";

const taskIcons = [UserPlus, MessageCircle, LogIn] as const;

export const HelpPage = () => {
  const { locale } = useAppLocale();

  return (
    <PublicPageShell>
      <div lang={locale} className="overflow-hidden">
        <section className="help-map">
          <div className="layout-shell relative min-h-[min(820px,calc(100dvh-4rem))] py-16 sm:py-24">
            <div className="help-map-rings" aria-hidden="true"><i /><i /><i /></div>
            <p className="relay-kicker relative z-10">{localizeText("Bản đồ trợ giúp")}</p>
            <h1 className="help-map-title">{UI_COPY.help.title}</h1>
            <p className="help-map-intro">{UI_COPY.help.description}</p>
            <nav className="help-map-actions" aria-label={UI_COPY.help.tasksTitle}>
              {UI_COPY.help.tasks.map((task, index) => {
                const Icon = taskIcons[index];
                return <Link key={task.title} href={task.href} className={`focus-ring help-map-action help-map-action-${index + 1}`}><span className="help-map-action-index">0{index + 1}</span><Icon size={20} aria-hidden="true" /><strong>{task.title}</strong><small>{task.description}</small><span className="help-map-action-link">{task.action}<ArrowRight size={15} aria-hidden="true" /></span></Link>;
              })}
            </nav>
          </div>
        </section>

        <section className="help-answers">
          <div className="layout-shell py-24 sm:py-32">
            <LandingReveal className="grid gap-16 lg:grid-cols-[0.34fr_0.66fr]">
              <div className="lg:sticky lg:top-28 lg:self-start"><p className="relay-kicker text-primary">{localizeText("Chọn đúng tín hiệu")}</p><h2>{UI_COPY.help.faqTitle}</h2><p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">{localizeText("Không cần đọc hết. Mở câu hỏi gần nhất với chỗ bạn đang mắc.")}</p></div>
              <HelpFaqList />
            </LandingReveal>
          </div>
        </section>

        <section className="help-compass">
          <div className="layout-shell py-24 sm:py-32">
            <LandingReveal className="grid gap-12 lg:grid-cols-[0.58fr_0.42fr] lg:items-end"><div><p className="relay-kicker text-primary">{localizeText("La bàn nhỏ")}</p><h2>{UI_COPY.help.tipsTitle}</h2></div><p className="text-landing-on-ink-muted max-w-sm text-sm leading-6">{localizeText("Bốn dấu hiệu giúp bạn quay lại đúng ngữ cảnh trước khi gửi tin.")}</p></LandingReveal>
            <LandingReveal className="mt-16" delay={0.08}><HelpTipCards /></LandingReveal>
            <div className="landing-line-on-ink mt-20 flex flex-col gap-6 border-t pt-8 sm:flex-row sm:items-center sm:justify-between"><p className="text-landing-on-ink-muted max-w-xl text-base leading-7">{UI_COPY.help.supportLine}</p><Link href="/app" className="landing-button landing-button-primary focus-ring self-start"><span className="landing-button-label"><BrandText text={localizeText("Mở Nối")} /></span><ArrowRight className="landing-button-icon" size={17} aria-hidden="true" /></Link></div>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
};

export default HelpPage;
