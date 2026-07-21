import { PublicPageShell } from "@/pages/shared/PublicPageShell";
import { SurfacePanel } from "@/shared/ui/SurfacePanel";
import { SectionHeader } from "@/shared/ui/SectionHeader";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

export const TermsPage = () => {
  return (
    <PublicPageShell title={UI_COPY.brand} topClassName="pt-6">
      <motion.div
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.panelReveal}
      >
        <SurfacePanel className="layout-stack p-6 md:p-8">
          <SectionHeader
            title={UI_COPY.terms.title}
            description={UI_COPY.terms.description}
          />
          <div className="layout-stack">
            {UI_COPY.terms.items.map((section) => (
              <section key={section.title} className="rounded-lg border border-border/65 p-4">
                <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{section.body}</p>
              </section>
            ))}
          </div>
        </SurfacePanel>
      </motion.div>
    </PublicPageShell>
  );
};

export default TermsPage;
