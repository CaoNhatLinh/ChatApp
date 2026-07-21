import { type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

interface SkeletonProps {
  className?: string;
  children?: ReactNode;
}

export const Skeleton = ({ className, children }: SkeletonProps) => {
  return <div className={cn("animate-pulse rounded-lg bg-muted/70", className)}>{children}</div>;
};

export const SkeletonLine = ({ className }: { className?: string }) => {
  return <div className={cn("h-4 rounded-md bg-muted/70 animate-pulse", className)} />;
};

export default Skeleton;

