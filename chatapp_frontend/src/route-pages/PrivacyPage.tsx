import { LockKeyhole } from "lucide-react";
import { PublicPageShell } from "@/route-pages/shared/PublicPageShell";
import { PrivacyPolicyCards } from "@/route-pages/privacy/components/PrivacyPolicyCards";
import { PrivacyPageCta } from "@/route-pages/privacy/components/PrivacyPageCta";
import { UI_COPY } from "@/shared/constants/ui-copy";

export const PrivacyPage = () => {
  return (
    <PublicPageShell>
      <div className="layout-shell py-14 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div className="page-intro">
            <span className="brand-mark h-11 w-11 rounded-[0.7rem]"><LockKeyhole size={20} aria-hidden="true" /></span>
            <p className="page-kicker mt-6">{UI_COPY.privacy.eyebrow}</p>
            <h1 className="max-w-[10ch] text-5xl font-bold leading-[1.02] tracking-[-0.045em] sm:text-6xl">{UI_COPY.privacy.title}</h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">{UI_COPY.privacy.description}</p>
            <PrivacyPageCta />
          </div>
          <PrivacyPolicyCards />
        </div>
      </div>
    </PublicPageShell>
  );
};

export default PrivacyPage;
