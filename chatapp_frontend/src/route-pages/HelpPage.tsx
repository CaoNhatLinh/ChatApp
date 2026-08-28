import { ArrowUpRight, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { PublicPageShell } from "@/route-pages/shared/PublicPageShell";
import { HelpFaqList } from "@/route-pages/help/components/HelpFaqList";
import { HelpTipCards } from "@/route-pages/help/components/HelpTipCards";
import { UI_COPY } from "@/shared/constants/ui-copy";

export const HelpPage = () => {
  return (
    <PublicPageShell>
      <div className="layout-shell py-14 lg:py-20">
        <div className="page-intro">
          <p className="page-kicker">{UI_COPY.help.eyebrow}</p>
          <h1 className="max-w-[14ch] text-5xl font-bold leading-[1.02] tracking-[-0.045em] sm:text-6xl">{UI_COPY.help.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{UI_COPY.help.description}</p>
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-20">
          <section aria-labelledby="faq-title">
            <div className="mb-5 flex items-center gap-3">
              <span className="brand-mark h-9 w-9 rounded-[0.65rem]"><LifeBuoy size={17} aria-hidden="true" /></span>
              <h2 id="faq-title" className="text-xl font-semibold">{UI_COPY.help.faqTitle}</h2>
            </div>
            <HelpFaqList />
          </section>

          <aside className="self-start border-t border-border pt-5" aria-labelledby="tips-title">
            <h2 id="tips-title" className="text-xl font-semibold">{UI_COPY.help.tipsTitle}</h2>
            <div className="mt-5"><HelpTipCards /></div>
            <Link href="/app" className="focus-ring mt-7 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px">{UI_COPY.help.quickStartButton}<ArrowUpRight size={17} aria-hidden="true" /></Link>
            <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">{UI_COPY.help.supportLine}</p>
          </aside>
        </div>
      </div>
    </PublicPageShell>
  );
};

export default HelpPage;
