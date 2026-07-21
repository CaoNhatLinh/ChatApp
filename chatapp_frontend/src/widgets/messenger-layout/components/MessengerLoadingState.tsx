import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

export const MessengerLoadingState = () => {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px]"
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.loadingGlow}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-foreground/20 rounded-full blur-[100px]"
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.loadingGlowShifted}
        />
      </div>

      <motion.div
        className="flex flex-col items-center gap-4 z-10"
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.fadeIn}
      >
        <motion.div
          className="w-12 h-12 border-3 border-border border-t-primary rounded-full"
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.loadingSpin}
        />
        <motion.p
          className="text-sm font-black uppercase tracking-[0.16em] text-muted-foreground"
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.loadingPulse}
        >
          Dang tai du lieu...
        </motion.p>
      </motion.div>
    </div>
  );
};

export default MessengerLoadingState;
