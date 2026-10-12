"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/shared/lib/cn";

interface SignalThreadProps {
  className?: string;
  variant?: "arc" | "wave";
}

export const SignalThread = ({ className, variant = "arc" }: SignalThreadProps) => {
  const reduceMotion = useReducedMotion();
  const path = variant === "arc"
    ? "M24 264C164 34 378 14 544 156C670 264 798 290 976 76"
    : "M18 118C174 20 278 222 438 112C590 8 720 190 982 46";

  return (
    <svg className={cn("pointer-events-none overflow-visible", className)} viewBox="0 0 1000 300" fill="none" aria-hidden="true" preserveAspectRatio="none">
      <path d={path} stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      <motion.path d={path} stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 18" initial={{ pathLength: reduceMotion ? 1 : 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 0.9 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: reduceMotion ? 0 : 1.6, ease: [0.25, 1, 0.5, 1] }} />
      {[0.12, 0.52, 0.88].map((offset, index) => (
        <motion.circle key={offset} r={index === 1 ? 7 : 4} fill="var(--primary)" initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: reduceMotion ? 0 : 0.35 + index * 0.2, duration: 0.45 }}>
          <animateMotion dur="0.01s" fill="freeze" keyPoints={`${offset};${offset}`} keyTimes="0;1" path={path} />
        </motion.circle>
      ))}
    </svg>
  );
};

export default SignalThread;
