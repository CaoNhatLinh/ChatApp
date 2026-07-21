import { Navigate } from "react-router-dom";
import { AppPageShell } from "@/pages/shared/AppPageShell";
import { ActivityFeed } from "@/pages/activity/components/ActivityFeed";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { ActivityPageSkeleton } from "@/pages/activity/components/ActivityPageSkeleton";
import { SurfacePanel, SectionHeader } from "@/shared/ui";
import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

export const ActivityPage = () => {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <AppPageShell>
        <ActivityPageSkeleton />
      </AppPageShell>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppPageShell>
      <motion.div
        className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]"
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.panelReveal}
      >
        <SurfacePanel className="layout-stack">
          <SectionHeader title={UI_COPY.activity.title} description={UI_COPY.activity.description} />
          <ActivityFeed />
        </SurfacePanel>

        <SurfacePanel className="layout-stack">
          <SectionHeader title={UI_COPY.activity.tipTitle} description={UI_COPY.activity.feedHint} />
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>{UI_COPY.activity.tipBody}</p>
            <p>{UI_COPY.activity.tipHint}</p>
          </div>
        </SurfacePanel>
      </motion.div>
    </AppPageShell>
  );
};

export default ActivityPage;
