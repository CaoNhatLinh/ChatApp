import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useCallback } from "react";
import { UserSettingsModal } from "@/features/settings/ui/UserSettingsModal";
import { AppPageShell } from "@/pages/shared/AppPageShell";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { SettingsPageSkeleton } from "@/features/settings/ui/SettingsPageSkeleton";
import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

export const SettingsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuthStore();
  const tab = searchParams.get("tab");

  const initialTab = tab === "appearance" ? "appearance" : "profile";

  const handleClose = useCallback(() => {
    void navigate("/app");
  }, [navigate]);

  if (loading) {
    return (
      <AppPageShell>
        <motion.div
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.panelReveal}
        >
          <SettingsPageSkeleton />
        </motion.div>
      </AppPageShell>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppPageShell>
      <motion.div
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.panelReveal}
      >
        <UserSettingsModal
          isOpen
          mode="page"
          onClose={handleClose}
          initialTab={initialTab}
        />
      </motion.div>
    </AppPageShell>
  );
};

export default SettingsPage;
