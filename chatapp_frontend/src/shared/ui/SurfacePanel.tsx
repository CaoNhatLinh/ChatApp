import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

interface SurfacePanelProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}

export const SurfacePanel = ({
  title,
  headerAction,
  children,
  className,
  ...props
}: SurfacePanelProps) => {
  return (
    <section
      className={cn(
        "rounded-[1.2rem] border border-border/60 bg-card/92 backdrop-blur-sm",
        "shadow-[0_12px_30px_-24px_rgba(0,0,0,0.28)] hover:shadow-[0_16px_36px_-26px_rgba(0,0,0,0.42)] hover:border-primary/25",
        "transition-all duration-250 overflow-hidden",
        className
      )}
      {...props}
    >
      {title || headerAction ? (
        <header className="flex items-center justify-between gap-3 border-b border-border/45 px-5 py-3 text-sm">
          {title ? <h3 className="text-sm font-black uppercase tracking-[0.12em]">{title}</h3> : <span />}
          {headerAction}
        </header>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
};

SurfacePanel.displayName = "SurfacePanel";
