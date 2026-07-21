import { PublicPageShell } from "@/pages/shared/PublicPageShell";
import { AboutIntro } from "@/pages/about/components/AboutIntro";
import { AboutValueCards } from "@/pages/about/components/AboutValueCards";
import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

export const AboutPage = () => {
  return (
    <PublicPageShell>
      <motion.section
        className="layout-stack sm:!flex-row sm:gap-8 items-start"
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.panelReveal}
      >
        <AboutIntro />
        <AboutValueCards />
      </motion.section>
    </PublicPageShell>
  );
};

export default AboutPage;
