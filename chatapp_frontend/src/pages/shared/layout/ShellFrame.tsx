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
    <div className={cn("page-shell relative min-h-screen overflow-hidden", className)}>
      <div className={cn("absolute inset-0 pointer-events-none", ambientClasses[ambient])}>
        <div className="mx-auto h-[320px] w-[680px] rounded-full bg-primary/30 blur-[140px] opacity-75" />
        <div className="absolute inset-x-0 top-16 h-[260px] bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.2),transparent_62%)]" />
        <div className="absolute inset-x-[-40px] bottom-[-30px] h-[220px] bg-[radial-gradient(circle_at_50%_60%,rgba(255,255,255,0.14),transparent_64%)]" />
      </div>
      {children}
    </div>
  );
};

export default ShellFrame;
