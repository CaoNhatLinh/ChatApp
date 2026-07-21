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
      <div className="surface-elevated p-10 rounded-[1.25rem] flex flex-col items-center gap-6 max-w-sm">
        <motion.div
          className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary"
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.loadingFloat}
        >
          <MessageCircle size={48} />
        </motion.div>
        <div>
          <h3 className="text-2xl font-black uppercase tracking-tight mb-2">{title}</h3>
          <p className="text-muted-foreground text-sm font-medium">{message}</p>
        </div>
      </div>
    </motion.div>
  );
};
