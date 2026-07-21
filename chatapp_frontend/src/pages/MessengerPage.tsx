import React from 'react';
import { MessengerLayout } from '@/widgets/messenger-layout';
import { AppPageShell } from '@/pages/shared/AppPageShell';
import { motion } from 'framer-motion';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';

export const MessengerPage: React.FC = () => {
  return (
    <AppPageShell
      fullWidth
      contentClassName="h-[calc(100vh-5rem)] overflow-hidden p-0 pt-0 pb-0"
    >
      <motion.div
        className="h-full"
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.fadeIn}
      >
        <MessengerLayout />
      </motion.div>
    </AppPageShell>
  );
};

export default MessengerPage;
