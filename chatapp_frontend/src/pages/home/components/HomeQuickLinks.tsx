import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

const quickLinks: { to: string; label: string }[] = [
  {
    to: "/about",
    label: String(UI_COPY.home.aboutNova),
  },
  {
    to: "/help",
    label: String(UI_COPY.help.title),
  },
  {
    to: "/privacy",
    label: String(UI_COPY.privacy.title),
  },
  {
    to: "/search",
    label: String(UI_COPY.home.quickLinkSearch),
  },
  {
    to: "/terms",
    label: String(UI_COPY.terms.title),
  },
];

export const HomeQuickLinks = () => {
  return (
    <motion.section
      className="layout-grid-auto"
      aria-label={String(UI_COPY.home.heroEyebrow)}
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.panelReveal}
    >
      {quickLinks.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          aria-label={link.label}
          className="surface p-5 border border-border/65 flex items-center justify-between rounded-[1rem] transition hover:-translate-y-1 hover:shadow-soft"
        >
          <span>{link.label}</span>
          <span aria-hidden="true" className="text-xs text-muted-foreground">
            →
          </span>
        </Link>
      ))}
    </motion.section>
  );
};

export default HomeQuickLinks;
