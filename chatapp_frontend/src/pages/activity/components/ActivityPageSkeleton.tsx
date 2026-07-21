import { SurfacePanel, Skeleton, SkeletonLine } from "@/shared/ui";
import { SectionHeader } from "@/shared/ui/SectionHeader";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { UI_MOTION_VARIANTS, UI_MOTION_CONFIG } from "@/shared/constants/ui-motion-variants";
import { motion } from "framer-motion";

const ActivityFeedSkeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 4 }).map((_, index) => (
      <motion.div
        key={`activity-skeleton-item-${index}`}
        variants={UI_MOTION_VARIANTS.rowReveal}
        className="rounded-xl border border-border/50 bg-card/45 p-4"
      >
        <div className="space-y-2 rounded-lg border border-border/30 p-3">
          <SkeletonLine className="h-4 w-4/5" />
          <SkeletonLine className="h-4 w-1/2" />
        </div>
      </motion.div>
    ))}
  </div>
);

const ActivityTipsSkeleton = () => (
  <div className="space-y-3">
    <SkeletonLine className="h-4 w-4/5" />
    <SkeletonLine className="h-4 w-3/5" />
    <Skeleton className="h-8 w-full" />
  </div>
);

export const ActivityPageSkeleton = () => (
  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
    <motion.div initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.panelReveal}>
      <SurfacePanel className="layout-stack">
        <SectionHeader title={UI_COPY.activity.title} description={UI_COPY.activity.description} />
        <ActivityFeedSkeleton />
      </SurfacePanel>
    </motion.div>
    <motion.div initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.panelReveal}>
      <SurfacePanel className="layout-stack">
        <SectionHeader title={UI_COPY.activity.tipTitle} description={UI_COPY.activity.feedHint} />
        <ActivityTipsSkeleton />
      </SurfacePanel>
    </motion.div>
    <p className="sr-only">{UI_COPY.status.loadingDataHint}</p>
  </div>
);

export default ActivityPageSkeleton;
