"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowRight } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { PublicPageShell } from "@/route-pages/shared/PublicPageShell";
import { LandingReveal } from "@/route-pages/shared/landing/LandingReveal";
import { SignalShader } from "@/route-pages/shared/landing/SignalShader";
import { SignalSequence } from "@/route-pages/shared/landing/SignalSequence";
import { SignalThread } from "@/route-pages/shared/landing/SignalThread";
import { TechnologyRelay } from "@/route-pages/shared/landing/TechnologyRelay";
import { localizeText, useAppLocale } from "@/shared/i18n";
import { BrandText } from "@/shared/ui/BrandWord";

export const HomePage = () => {
  const { locale } = useAppLocale();
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const heroVisualY = useTransform(scrollY, [0, 920], [0, 104]);
  const heroVisualScale = useTransform(scrollY, [0, 920], [1, 0.94]);

  return (
    <PublicPageShell>
      <div lang={locale} className="overflow-hidden">
        <section className="relay-hero">
          <SignalShader className="opacity-75" />
          <div className="relay-hero-veil" />
          <div className="layout-shell relative z-10 min-h-[min(880px,calc(100dvh-4rem))] py-10 sm:py-16">
            <div className="relay-hero-index" aria-hidden="true">SIGNAL / 001</div>
            <div className="relative grid min-h-[680px] items-center lg:grid-cols-[1.05fr_0.95fr]">
              <div className="relative z-20 pt-16 lg:pt-0">
                <p className="relay-kicker">{localizeText("Nối là project tôi đang làm")}</p>
                <h1 className="relay-display max-w-[10ch] text-landing-on-ink">{localizeText("Tôi học bằng cách tự làm một app chat.")}</h1>
                <p className="text-landing-on-ink-muted mt-7 max-w-md text-base leading-7 sm:ml-[18%] sm:text-lg sm:leading-8"><BrandText text={localizeText("Tôi dùng Nối để học cách xây một app có người thật nhắn tin, dữ liệu thay đổi và giao diện phải theo kịp.")} /></p>
                <div className="mt-8 flex flex-wrap gap-3 sm:ml-[18%]">
                  <Link href="/app" className="landing-button landing-button-primary focus-ring"><span className="landing-button-label">{localizeText("Mở Nối")}</span><ArrowRight className="landing-button-icon" size={17} aria-hidden="true" /></Link>
                  <Link href="/about" className="landing-button landing-button-secondary-dark focus-ring"><span className="landing-button-label">{localizeText("Xem Nối được làm thế nào")}</span></Link>
                </div>
              </div>

              <motion.div className="relay-hero-visual" role="img" aria-label={localizeText("Minh họa các dải tín hiệu hội tụ trong Nối")} style={reduceMotion ? undefined : { y: heroVisualY, scale: heroVisualScale }}>
                <div className="relay-hero-image"><Image src="/noi-relay-hero.png" alt="" fill priority sizes="(max-width: 1024px) 92vw, 52vw" className="object-cover" /></div>
                <div className="relay-orbit relay-orbit-a" /><div className="relay-orbit relay-orbit-b" />
                <div className="relay-live"><span />{localizeText("Đang truyền")}</div>
                <p className="relay-side-note">{localizeText("Một việc xảy ra, mọi người cần thấy đúng lúc.")}</p>
              </motion.div>
            </div>
            <a href="#manifesto" className="focus-ring relay-scroll-cue">{localizeText("Xem tiếp")}<ArrowDownRight size={18} aria-hidden="true" /></a>
          </div>
        </section>

        <section id="manifesto" className="relay-manifesto">
          <div className="layout-shell relative py-24 sm:py-32">
            <SignalThread className="absolute left-[-8%] top-12 h-[72%] w-[116%] text-foreground" />
            <div className="relative z-10 grid gap-14 lg:grid-cols-[0.34fr_0.66fr]">
              <div><p className="relay-kicker text-primary">{localizeText("Nối là gì?")}</p><p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">{localizeText("Nối là phần mềm tôi làm để luyện frontend, realtime và những tình huống người dùng thật thường gặp.")}</p></div>
              <div className="space-y-2">
                <p className="relay-statement">{localizeText("Tin nhắn")}<span>{localizeText("cần đúng ngữ cảnh.")}</span></p>
                <p className="relay-statement relay-statement-offset">{localizeText("Trạng thái")}<span>{localizeText("cần dễ nhận ra.")}</span></p>
                <p className="relay-statement">{localizeText("Quyền vào phòng")}<span>{localizeText("cần rõ ràng.")}</span></p>
              </div>
            </div>
          </div>
        </section>

        <section className="relay-sequence">
          <div className="layout-shell py-24 sm:py-32">
            <LandingReveal className="mb-14 flex max-w-4xl flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><h2 className="max-w-[12ch] text-4xl font-semibold leading-[0.96] tracking-[-0.04em] sm:text-6xl">{localizeText("Ba điều giúp cuộc trò chuyện không bị đứt.")}</h2><p className="max-w-xs text-sm leading-6 text-muted-foreground">{localizeText("Chọn từng tín hiệu để xem giao diện phản hồi và giữ ngữ cảnh ra sao.")}</p></LandingReveal>
            <LandingReveal delay={0.08}><SignalSequence /></LandingReveal>
          </div>
        </section>

        <TechnologyRelay />

      </div>
    </PublicPageShell>
  );
};

export default HomePage;
