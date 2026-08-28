import React from 'react';
import { AuthLayout } from '@/features/auth/ui/AuthLayout';
import { Login } from '@/features/auth/Login';
import { motion } from 'framer-motion';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import { localizeText } from '@/shared/i18n';

export const LoginPage: React.FC = () => {
  return (
    <motion.div
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.panelReveal}
    >
      <AuthLayout
        title={localizeText("Đăng nhập")}
        subtitle={localizeText("Chào mừng trở lại, vào nhanh để tiếp tục các hội thoại của bạn.")}
      >
        <Login />
      </AuthLayout>
    </motion.div>
  );
};

export default LoginPage;
