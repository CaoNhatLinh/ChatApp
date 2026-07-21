import { SurfacePanel, Skeleton, SkeletonLine } from "@/shared/ui";
import { motion } from "framer-motion";
import { UI_MOTION_VARIANTS, UI_MOTION_CONFIG } from "@/shared/constants/ui-motion-variants";

export const ProfilePageSkeleton = () => {
  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <motion.div
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.panelReveal}
      >
        <SurfacePanel className="space-y-4 rounded-2xl">
        <Skeleton className="mx-auto h-24 w-24 rounded-full" />
        <SkeletonLine className="h-6 w-3/4" />
        <SkeletonLine className="h-4 w-2/3" />
        </SurfacePanel>
      </motion.div>

      <section className="space-y-4">
        <motion.div
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.panelReveal}
        >
          <SurfacePanel className="space-y-3">
          <SkeletonLine className="h-5 w-1/3" />
          <SkeletonLine className="h-4 w-2/3" />
          <SkeletonLine className="h-4 w-1/2" />
          </SurfacePanel>
        </motion.div>
        <motion.div
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.panelReveal}
        >
          <SurfacePanel className="space-y-3">
          <SkeletonLine className="h-5 w-1/3" />
          <SkeletonLine className="h-10 w-4/5" />
          <SkeletonLine className="h-10 w-3/5" />
          </SurfacePanel>
        </motion.div>
      </section>
    </div>
  );
};

export default ProfilePageSkeleton;
