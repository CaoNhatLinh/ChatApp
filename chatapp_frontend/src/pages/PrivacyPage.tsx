import { PublicPageShell } from "@/pages/shared/PublicPageShell";
import { PrivacyPolicyCards } from "@/pages/privacy/components/PrivacyPolicyCards";
import { PrivacyPageCta } from "@/pages/privacy/components/PrivacyPageCta";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

export const PrivacyPage = () => {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-4xl layout-stack">
        <motion.div
          className="surface-elevated p-8 md:p-10 border border-border/70 layout-stack"
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.panelReveal}
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            {UI_COPY.privacy.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.02em] md:text-4xl">{UI_COPY.privacy.title}</h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">{UI_COPY.privacy.description}</p>

          <PrivacyPolicyCards />
          <PrivacyPageCta />
        </motion.div>
      </main>
    </PublicPageShell>
  );
};

export default PrivacyPage;
