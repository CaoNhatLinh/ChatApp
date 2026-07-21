import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useAuthCheck } from '@/features/auth/hooks/useAuthCheck';
import { motion } from "framer-motion";
import { UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";
import { UI_MOTION_CONFIG } from "@/shared/constants/ui-motion-variants";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, token } = useAuthStore();
  const location = useLocation();

  useAuthCheck();

  if (loading) {
    return (
      <div className="page-shell min-h-screen flex items-center justify-center">
        <motion.div className="text-center" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.fadeIn}>
          <motion.div
            className="h-12 w-12 border-2 border-border/40 border-t-primary rounded-full mx-auto mb-4"
            initial={UI_MOTION_CONFIG.initialState}
            animate={UI_MOTION_CONFIG.animateState}
            variants={UI_MOTION_VARIANTS.loadingSpin}
          />
          <p className="text-muted-foreground">Loading...</p>
        </motion.div>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
