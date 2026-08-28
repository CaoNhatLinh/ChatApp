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
        "rounded-[var(--radius-lg)] border border-border/70 bg-card",
        "neo-shadow hover:border-primary/35",
        "transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-250 overflow-hidden",
        className
      )}
      {...props}
    >
      {title || headerAction ? (
        <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3 text-sm">
          {title ? <h3 className="text-sm font-semibold tracking-tight">{title}</h3> : <span />}
          {headerAction}
        </header>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
};

SurfacePanel.displayName = "SurfacePanel";

