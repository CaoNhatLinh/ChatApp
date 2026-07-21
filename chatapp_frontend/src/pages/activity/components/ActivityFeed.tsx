import { motion } from "framer-motion";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";
import { ActivityItem } from "@/pages/activity/components/ActivityItem";

export const ActivityFeed = () => {
  return (
    <motion.ul
      className="layout-stack"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.panelReveal}
    >
      {UI_COPY.activity.items.map((activity) => (
        <ActivityItem
          key={`${activity.title}-${activity.time}`}
          title={activity.title}
          type={activity.type}
          time={activity.time}
          detail={activity.detail}
        />
      ))}
    </motion.ul>
  );
};

export default ActivityFeed;
