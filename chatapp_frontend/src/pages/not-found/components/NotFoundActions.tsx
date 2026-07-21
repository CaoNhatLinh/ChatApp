import { Link } from "react-router-dom";
import { Home, MessageCircle, Search } from "lucide-react";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

export const NotFoundActions = () => {
  return (
    <motion.div
      className="mt-2 flex flex-wrap justify-center gap-3"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.panelReveal}
    >
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.rowReveal}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-105"
        >
          <Home size={16} />
          {UI_COPY.notFound.actionHome}
        </Link>
      </motion.div>

      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.rowReveal}
      >
        <Link
          to="/app"
          className="inline-flex items-center gap-2 rounded-xl border border-border/70 px-4 py-3 text-sm font-bold hover:bg-accent"
        >
          <MessageCircle size={16} />
          {UI_COPY.notFound.actionChat}
        </Link>
      </motion.div>

      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.rowReveal}
      >
        <Link
          to="/search"
          className="inline-flex items-center gap-2 rounded-xl border border-border/70 px-4 py-3 text-sm font-bold hover:bg-accent"
        >
          <Search size={16} />
          {UI_COPY.notFound.actionSearch}
        </Link>
      </motion.div>
    </motion.div>
  );
};
