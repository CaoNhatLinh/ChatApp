import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { UI_COPY } from "@/shared/constants/ui-copy";

export const HomeHero = () => {
  return (
    <section className="grid gap-6 rounded-[1.25rem] p-6 sm:p-10 md:p-12 surface-elevated">
      <div className="space-y-6 max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          NovaChat Experience
        </p>
        <h1 className="text-3xl md:text-5xl font-black tracking-[-0.025em] max-w-[18ch] leading-tight">
          {UI_COPY.home.heroTitle}
        </h1>
        <p className="max-w-prose text-[1rem] leading-7 text-muted-foreground">
          {UI_COPY.home.heroDesc}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-primary-foreground font-bold transition hover:translate-y-[-1px] hover:shadow-soft"
          >
            {UI_COPY.home.ctaPrimary}
            <ArrowRight size={18} />
          </Link>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background px-5 py-3 font-semibold transition-colors hover:bg-card"
          >
            {UI_COPY.home.ctaSecondary}
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HomeHero;
