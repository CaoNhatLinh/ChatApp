import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type AmbientTone = "subtle" | "normal" | "strong";

interface ShellFrameProps {
  children: ReactNode;
  ambient?: AmbientTone;
  className?: string;
}

const ambientClasses: Record<AmbientTone, string> = {
  subtle: "opacity-20 top-0 mt-6",
  normal: "opacity-28 top-0",
  strong: "opacity-35 top-[-70px]",
};

export const ShellFrame = ({ children, ambient = "normal", className }: ShellFrameProps) => {
  return (
    <div className={cn("page-shell relative min-h-[100dvh] overflow-hidden", className)}>
      <div className={cn("absolute inset-0 pointer-events-none", ambientClasses[ambient])}>
        <div className="mx-auto h-[300px] w-[560px] rounded-full bg-primary/20 blur-[120px]" />
      </div>
      {children}
    </div>
  );
};

export default ShellFrame;
