import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { ProfileAccessNote } from "@/pages/profile/components/ProfileAccessNote";
import { ProfileIdentityCard } from "@/pages/profile/components/ProfileIdentityCard";
import { ProfileInfoGrid } from "@/pages/profile/components/ProfileInfoGrid";
import { ProfileQuickLinks } from "@/pages/profile/components/ProfileQuickLinks";
import { AppPageShell } from "@/pages/shared/AppPageShell";
import { PROFILE_COPY } from "@/pages/profile/constants/profile.constants";
import { ProfilePageSkeleton } from "@/pages/profile/components/ProfilePageSkeleton";
import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

export const ProfilePage = () => {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <AppPageShell>
        <main>
          <ProfilePageSkeleton />
          <span className="sr-only">{PROFILE_COPY.loading}</span>
        </main>
      </AppPageShell>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const display = user.displayName || user.nickName || user.userName || PROFILE_COPY.fallbackName;
  const avatarText = display.trim().charAt(0).toUpperCase();

  return (
    <AppPageShell>
      <motion.main
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.panelReveal}
      >
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <ProfileIdentityCard
            display={display}
            userName={user.userName}
            avatarText={avatarText}
          />
          <section className="space-y-4">
            <ProfileInfoGrid userId={user.userId} userName={user.userName} />
            <ProfileQuickLinks />
            <ProfileAccessNote />
          </section>
        </div>
      </motion.main>
    </AppPageShell>
  );
};

export default ProfilePage;
