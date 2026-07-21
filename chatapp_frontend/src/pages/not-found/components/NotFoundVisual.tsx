import { UI_COPY } from "@/shared/constants/ui-copy";
import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

export const NotFoundVisual = () => {
  return (
    <motion.div
      className="surface-elevated max-w-2xl w-full p-10 text-center layout-stack"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.panelReveal}
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{UI_COPY.brand}</p>
      <p className="text-5xl font-black tracking-[-0.03em]">{UI_COPY.notFound.code}</p>
      <p className="mt-4 text-lg text-muted-foreground max-w-md mx-auto leading-7">
        {UI_COPY.notFound.title}
      </p>
    </motion.div>
  );
};

export default NotFoundVisual;
