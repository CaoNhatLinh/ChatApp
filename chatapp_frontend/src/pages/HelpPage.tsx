import { Search, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPageShell } from "@/pages/shared/PublicPageShell";
import { HelpFaqList } from "@/pages/help/components/HelpFaqList";
import { HelpTipCards } from "@/pages/help/components/HelpTipCards";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

export const HelpPage = () => {
  return (
    <PublicPageShell>
      <motion.div
        className="layout-stack"
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.panelReveal}
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            {UI_COPY.help.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl md:text-5xl font-black tracking-[-0.02em]">
            {UI_COPY.help.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
            {UI_COPY.help.description}
          </p>
        </div>

        <HelpFaqList />
        <HelpTipCards />

        <Link
          to="/app"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
        >
          {UI_COPY.help.quickStartButton}
          <ArrowRight size={16} />
        </Link>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Search size={14} />
          {UI_COPY.help.supportLine}
        </div>
      </motion.div>
    </PublicPageShell>
  );
};

export default HelpPage;
