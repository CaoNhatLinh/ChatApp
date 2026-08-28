import React from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { motion } from "framer-motion";
import { UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";
import { UI_MOTION_CONFIG } from "@/shared/constants/ui-motion-variants";
import { localizeText } from '@/shared/i18n';

interface AuthRedirectProps {
  children: React.ReactNode;
}

export const AuthRedirect: React.FC<AuthRedirectProps> = ({ children }) => {
  const { user, loading, token } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && token && user) {
      router.replace('/app');
    }
  }, [loading, router, token, user]);

  if (loading) {
    return (
      <div className="page-shell min-h-[100dvh] flex items-center justify-center">
        <motion.div className="text-center" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.fadeIn}>
          <motion.div
            className="h-12 w-12 border-2 border-border/40 border-t-primary rounded-full mx-auto mb-4"
            initial={UI_MOTION_CONFIG.initialState}
            animate={UI_MOTION_CONFIG.animateState}
            variants={UI_MOTION_VARIANTS.loadingSpin}
          />
          <p className="text-muted-foreground">{localizeText("Đang tải...")}</p>
        </motion.div>
      </div>
    );
  }

  if (token && user) {
    return null;
  }

  return <>{children}</>;
};
