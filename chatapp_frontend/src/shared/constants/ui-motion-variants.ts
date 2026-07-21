import type { Variants } from "framer-motion";

export const UI_MOTION_VARIANTS = {
  panelReveal: {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.22, ease: "easeOut", staggerChildren: 0.06 },
    },
  } as Variants,

  rowReveal: {
    hidden: { opacity: 0.6, y: 4 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" } },
  } as Variants,

  gentleRowReveal: {
    hidden: { opacity: 0.45, y: 6 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" } },
  } as Variants,

  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.25, ease: "easeOut" } },
  } as Variants,

  slideInFromBottom: {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" } },
  } as Variants,

  slideInFromTop: {
    hidden: { opacity: 0, y: -8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" } },
  } as Variants,

  slideInFromRight: {
    hidden: { opacity: 0, x: 16 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.24, ease: "easeOut" } },
  } as Variants,

  slideInFromLeft: {
    hidden: { opacity: 0, x: -16 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.24, ease: "easeOut" } },
  } as Variants,

  zoomReveal: {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.22, ease: "easeOut" } },
  } as Variants,

  softPulse: {
    hidden: { opacity: 0.55, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.35, ease: "easeOut", repeat: 1, repeatType: "reverse" },
    },
  } as Variants,

  loadingGlow: {
    hidden: { opacity: 0.15 },
    visible: {
      opacity: [0.15, 0.35, 0.18],
      transition: { duration: 2.4, repeat: Number.POSITIVE_INFINITY, repeatType: "mirror", ease: "easeInOut" },
    },
  } as Variants,

  loadingGlowShifted: {
    hidden: { opacity: 0.18 },
    visible: {
      opacity: [0.18, 0.38, 0.2],
      transition: { duration: 2.4, repeat: Number.POSITIVE_INFINITY, repeatType: "mirror", ease: "easeInOut", delay: 1 },
    },
  } as Variants,

  loadingSpin: {
    hidden: { rotate: 0 },
    visible: {
      rotate: 360,
      transition: { duration: 0.9, repeat: Number.POSITIVE_INFINITY, ease: "linear" },
    },
  } as Variants,

  loadingPulse: {
    hidden: { opacity: 0.45 },
    visible: {
      opacity: [0.45, 1, 0.45],
      transition: { duration: 1.2, repeat: Number.POSITIVE_INFINITY, repeatType: "mirror", ease: "easeInOut" },
    },
  } as Variants,

  loadingFloat: {
    hidden: { y: 0 },
    visible: {
      y: [0, -6, 0],
      transition: { duration: 1.2, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY },
    },
  } as Variants,
};

export const UI_MOTION_CONFIG = {
  reducedMotion: false,
  initialState: "hidden" as const,
  animateState: "visible" as const,
} as const;
