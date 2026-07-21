import React from 'react';
import { AuthLayout } from '@/features/auth/ui/AuthLayout';
import { Register } from '@/features/auth/Register';
import { motion } from 'framer-motion';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';

export const RegisterPage: React.FC = () => {
  return (
    <motion.div
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.panelReveal}
    >
      <AuthLayout
        title="Đăng ký tài khoản"
        subtitle="Tạo tài khoản để kết nối, trò chuyện và bắt đầu cộng tác liền mạch."
      >
        <Register />
      </AuthLayout>
    </motion.div>
  );
};

export default RegisterPage;
