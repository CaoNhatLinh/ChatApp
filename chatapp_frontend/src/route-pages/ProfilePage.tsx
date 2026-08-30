import { redirect } from "next/navigation";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { ProfileAccessNote } from "@/route-pages/profile/components/ProfileAccessNote";
import { ProfileIdentityCard } from "@/route-pages/profile/components/ProfileIdentityCard";
import { ProfileInfoGrid } from "@/route-pages/profile/components/ProfileInfoGrid";
import { ProfileQuickLinks } from "@/route-pages/profile/components/ProfileQuickLinks";
import { AppPageShell } from "@/route-pages/shared/AppPageShell";
import { PROFILE_COPY } from "@/route-pages/profile/constants/profile.constants";
import { ProfilePageSkeleton } from "@/route-pages/profile/components/ProfilePageSkeleton";
import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";
import { localizeText, useAppLocale } from '@/shared/i18n';

export const ProfilePage = () => {
  const { user, loading } = useAuthStore();
  const { locale } = useAppLocale();

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
    redirect('/login');
  }

  const display = user.displayName;
  return (
    <AppPageShell>
      <motion.main
        lang={locale}
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.panelReveal}
      >
        <header className="mb-7">
          <p className="page-kicker">{localizeText('Tài khoản')}</p>
          <h1 className="text-3xl font-bold tracking-[-0.03em]">{localizeText('Hồ sơ của bạn')}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{localizeText('Thông tin nhận diện và các lối tắt quan trọng trong Nối.')}</p>
        </header>
        <div className="grid gap-0 border-y border-border md:grid-cols-[220px_1fr]">
          <ProfileIdentityCard
            display={display}
            userName={user.userName}
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
