import React from 'react';
import { MessengerLayout } from '@/widgets/messenger-layout';
import { AppPageShell } from '@/route-pages/shared/AppPageShell';
import { motion } from 'framer-motion';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import { useAppLocale } from '@/shared/i18n';

export const MessengerPage: React.FC = () => {
  const { locale } = useAppLocale();

  return (
    <AppPageShell
      fullWidth
      showNavigation={false}
      contentClassName="h-[100dvh] min-h-[520px] overflow-hidden p-0 pt-0 pb-0 md:pt-0 md:pb-0"
    >
      <motion.div
        className="h-full"
        lang={locale}
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
