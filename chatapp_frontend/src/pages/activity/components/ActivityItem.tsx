import { cn } from "@/shared/lib/cn";
import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

interface ActivityItemProps {
  title: string;
  type: "message" | "friend" | "setting" | "system";
  time: string;
  detail: string;
}

const typeTone: Record<ActivityItemProps["type"], string> = {
  message: "text-primary border-primary/30 bg-primary/10",
  friend: "text-success border-success/30 bg-success/12",
  setting: "text-warning border-warning/30 bg-warning/12",
  system: "text-muted-foreground border-muted/30 bg-muted/25",
};

export const ActivityItem = ({ title, type, time, detail }: ActivityItemProps) => {
  return (
    <motion.li
      className={cn("rounded-xl border border-dashed p-4 transition hover:border-solid hover:border-current", typeTone[type])}
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.rowReveal}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <span className="text-xs text-muted-foreground">{time}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
    </motion.li>
  );
};

export default ActivityItem;
