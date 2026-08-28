import { FileText } from "lucide-react";
import { PublicPageShell } from "@/route-pages/shared/PublicPageShell";
import { UI_COPY } from "@/shared/constants/ui-copy";

export const TermsPage = () => {
  return (
    <PublicPageShell>
      <article className="layout-shell max-w-4xl py-14 lg:py-20">
        <header className="border-b border-border pb-8">
          <span className="brand-mark h-11 w-11 rounded-[0.7rem]"><FileText size={20} aria-hidden="true" /></span>
          <p className="page-kicker mt-6">NovaChat</p>
          <h1 className="max-w-[12ch] text-5xl font-bold leading-[1.02] tracking-[-0.045em] sm:text-6xl">{UI_COPY.terms.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{UI_COPY.terms.description}</p>
        </header>
        <div className="divide-y divide-border">
          {UI_COPY.terms.items.map((section) => (
            <section key={section.title} className="py-7">
              <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
      </article>
    </PublicPageShell>
  );
};

export default TermsPage;
