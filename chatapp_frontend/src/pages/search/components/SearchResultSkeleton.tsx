import { SurfacePanel, SkeletonLine } from "@/shared/ui";
import { UI_MOTION_VARIANTS, UI_MOTION_CONFIG } from "@/shared/constants/ui-motion-variants";
import { motion } from "framer-motion";

const SearchResultSkeleton = ({ itemCount = 4 }: { itemCount?: number }) => (
  <motion.div
    className="space-y-3"
    initial={UI_MOTION_CONFIG.initialState}
    animate={UI_MOTION_CONFIG.animateState}
    variants={UI_MOTION_VARIANTS.panelReveal}
  >
    {Array.from({ length: itemCount }).map((_, index) => (
      <motion.div key={`search-result-skeleton-${index}`} variants={UI_MOTION_VARIANTS.rowReveal}>
        <SurfacePanel className="space-y-3">
          <div className="flex items-center gap-2">
            <SkeletonLine className="h-4 w-2/5" />
            <SkeletonLine className="h-4 w-1/4" />
          </div>
          <SkeletonLine className="h-3 w-full" />
          <SkeletonLine className="h-3 w-4/5" />
        </SurfacePanel>
      </motion.div>
    ))}
  </motion.div>
);

export default SearchResultSkeleton;
