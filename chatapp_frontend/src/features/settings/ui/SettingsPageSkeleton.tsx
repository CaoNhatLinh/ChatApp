import { SurfacePanel, SectionHeader, Skeleton, SkeletonLine } from "@/shared/ui";
import { motion } from "framer-motion";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { UI_MOTION_VARIANTS, UI_MOTION_CONFIG } from "@/shared/constants/ui-motion-variants";

export const SettingsPageSkeleton = () => (
  <div className="space-y-4">
    <motion.div initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.panelReveal}>
      <SurfacePanel className="layout-stack">
        <SectionHeader title={UI_COPY.settings.profileTitle} description={UI_COPY.settings.profileDescription} />
        <motion.div className="space-y-4" variants={UI_MOTION_VARIANTS.gentleRowReveal}>
          <Skeleton className="h-24 w-24 rounded-full" />
          <SkeletonLine className="h-5 w-60" />
          <SkeletonLine className="h-10 w-full" />
          <SkeletonLine className="h-10 w-full" />
        </motion.div>
      </SurfacePanel>
    </motion.div>

    <motion.div initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.panelReveal}>
      <SurfacePanel className="layout-stack">
        <SectionHeader title={UI_COPY.settings.themeSystem} description={UI_COPY.settings.themeLight} />
        <motion.div className="space-y-3" variants={UI_MOTION_VARIANTS.gentleRowReveal}>
          <SkeletonLine className="h-4 w-56" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <SkeletonLine className="h-4 w-4/5" />
        </motion.div>
      </SurfacePanel>
    </motion.div>
  </div>
);

export default SettingsPageSkeleton;
