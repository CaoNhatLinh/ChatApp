import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { UI_MOTION_VARIANTS, UI_MOTION_CONFIG } from "@/shared/constants/ui-motion-variants";

interface ChatWindowToastProps {
  message: string;
}

export const ChatWindowToast = ({ message }: ChatWindowToastProps) => {
  return (
    <motion.div
      className="absolute top-24 left-1/2 -translate-x-1/2 z-50"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.panelReveal}
    >
      <div className="bg-card glass border border-border/50 neo-shadow px-6 py-3 rounded-2xl flex items-center gap-3">
        <MessageCircle size={18} className="text-primary" />
        <span className="font-bold text-sm tracking-wide">{message}</span>
      </div>
    </motion.div>
  );
};

export default ChatWindowToast;
