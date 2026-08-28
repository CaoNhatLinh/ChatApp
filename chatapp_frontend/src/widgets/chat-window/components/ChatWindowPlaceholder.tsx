import { MessageCircle } from 'lucide-react';
import { motion } from "framer-motion";
import { UI_MOTION_VARIANTS, UI_MOTION_CONFIG } from "@/shared/constants/ui-motion-variants";
import type { FC } from 'react';

interface ChatWindowPlaceholderProps {
  title: string;
  message: string;
}

export const ChatWindowPlaceholder: FC<ChatWindowPlaceholderProps> = ({ title, message }) => {
  return (
    <motion.div
      className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.fadeIn}
    >
      <div className="surface-elevated flex max-w-sm flex-col items-center gap-6 rounded-[var(--radius-lg)] p-10">
        <motion.div
          className="flex h-20 w-20 items-center justify-center rounded-[var(--radius-lg)] bg-primary/10 text-primary"
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.loadingFloat}
        >
          <MessageCircle size={48} />
        </motion.div>
        <div>
          <h3 className="mb-2 text-2xl font-semibold tracking-tight">{title}</h3>
          <p className="text-sm font-medium text-muted-foreground">{message}</p>
        </div>
      </div>
    </motion.div>
  );
};
