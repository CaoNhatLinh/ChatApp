import { motion } from 'framer-motion';
import { MessengerSectionPage } from '@/pages/messenger/components/MessengerSectionPage';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';

export const MessagesPage = () => {
  return (
    <motion.div
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.fadeIn}
    >
      <MessengerSectionPage view="chat" />
    </motion.div>
  );
};

export default MessagesPage;
