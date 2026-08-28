import { ArrowUpRight, CheckCircle2, Radio, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PublicPageShell } from "@/route-pages/shared/PublicPageShell";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { localizeText } from "@/shared/i18n";

const valueIcons = [CheckCircle2, Radio, ShieldCheck] as const;

export const AboutPage = () => {
  return (
    <PublicPageShell>
      <section className="layout-shell grid gap-12 py-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-20">
        <div className="page-intro">
          <p className="page-kicker">{localizeText("Về NovaChat")}</p>
          <h1 className="max-w-[11ch] text-5xl font-bold leading-[1.02] tracking-[-0.045em] sm:text-6xl">{localizeText("Một nơi để nói chuyện mà không phải nghĩ về công cụ.")}</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">{localizeText("NovaChat ưu tiên tốc độ, ngữ cảnh và quyền riêng tư để mỗi cuộc trò chuyện đi thẳng vào điều quan trọng.")}</p>
          <Link href="/help" className="focus-ring mt-8 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px">{localizeText("Xem hướng dẫn")} <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </div>

        <div className="self-end border-t border-border">
          {UI_COPY.about.values.map((value, index) => {
            const Icon = valueIcons[index];
            return (
              <article key={value.title} className="grid gap-4 border-b border-border py-6 sm:grid-cols-[48px_0.7fr_1.3fr] sm:items-start sm:gap-6">
                <span className="brand-mark h-10 w-10 rounded-[0.65rem]"><Icon size={18} aria-hidden="true" /></span>
                <h2 className="text-lg font-semibold">{value.title}</h2>
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
