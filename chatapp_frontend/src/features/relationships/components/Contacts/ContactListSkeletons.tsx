import { MessageCircle, Search, UserPlus, Users } from "lucide-react";
import { SurfacePanel, Skeleton, SkeletonLine } from "@/shared/ui";
import { UI_MOTION_VARIANTS, UI_MOTION_CONFIG } from "@/shared/constants/ui-motion-variants";
import { motion } from "framer-motion";

export const ContactRowSkeleton = () => {
  return (
    <motion.div
      variants={UI_MOTION_VARIANTS.rowReveal}
      className="flex items-center justify-between rounded-[1.2rem] border border-border/55 bg-card/55 px-4 py-3"
    >
      <div className="flex min-w-0 items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2">
          <SkeletonLine className="w-40" />
          <div className="flex items-center gap-2">
            <SkeletonLine className="w-24" />
            <SkeletonLine className="w-12" />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
    </motion.div>
  );
};

export const ContactListPanelSkeleton = ({ title, description }: { title: string; description: string }) => (
  <motion.div variants={UI_MOTION_VARIANTS.rowReveal}>
    <SurfacePanel className="space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonLine className="h-5 w-40" />
        <SkeletonLine className="h-4 w-16" />
      </div>
      <p className="text-sm text-muted-foreground">
        <span>{title}</span>
        <span className="sr-only">{description}</span>
      </p>
    </SurfacePanel>
  </motion.div>
);

export const FriendsListSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <motion.div
    className="space-y-3"
    initial={UI_MOTION_CONFIG.initialState}
    animate={UI_MOTION_CONFIG.animateState}
    variants={UI_MOTION_VARIANTS.panelReveal}
  >
    {Array.from({ length: rows }).map((_, index) => (
      <ContactRowSkeleton key={`friend-row-skeleton-${index}`} />
    ))}
  </motion.div>
);

export const FriendsAddSkeleton = () => {
  return (
    <motion.div
      className="space-y-4"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.panelReveal}
    >
      <SurfacePanel className="border border-border/30">
        <motion.div variants={UI_MOTION_VARIANTS.rowReveal} className="space-y-3">
          <div className="flex items-center justify-between">
            <SkeletonLine className="h-4 w-36" />
            <Users size={16} className="text-muted-foreground" />
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </motion.div>
      </SurfacePanel>
      <FriendsListSkeleton rows={5} />
      <motion.div
        className="flex items-center justify-center pt-2"
        variants={UI_MOTION_VARIANTS.gentleRowReveal}
      >
        <motion.div
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.loadingPulse}
        >
          <Search size={16} className="text-primary" />
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export const FriendsNoResultSkeleton = ({ label }: { label: string }) => (
  <motion.div variants={UI_MOTION_VARIANTS.rowReveal}>
    <SurfacePanel>
      <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/40 p-4 text-center">
        <UserPlus size={18} className="text-muted-foreground" />
        <SkeletonLine className="w-48" />
        <p className="text-xs text-muted-foreground">{label}</p>
        <MessageCircle size={14} className="text-muted-foreground" />
      </div>
    </SurfacePanel>
  </motion.div>
);
