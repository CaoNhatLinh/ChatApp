import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";
import { localizeText } from '@/shared/i18n';

export const MessengerLoadingState = () => {
  return (
    <div className="relative flex h-full min-h-[520px] w-full items-center justify-center overflow-hidden bg-background p-6">
      <motion.div className="absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-primary/15 blur-[100px]" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.loadingGlow} aria-hidden="true" />
      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        <motion.div className="brand-mark h-12 w-12 rounded-[0.8rem]" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.loadingSpin} aria-hidden="true"><img src="/novachat-app-mark.png" alt="" className="h-full w-full object-contain" /></motion.div>
        <p className="text-sm font-semibold text-muted-foreground">{localizeText('Đang tải dữ liệu...')}</p>
      </div>
    </div>
  );
};

export default MessengerLoadingState;
