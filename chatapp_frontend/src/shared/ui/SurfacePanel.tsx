import type { DetailsHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/cn";

interface SurfacePanelProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  headerAction?: ReactNode;
  /** Render the panel as an accessible native disclosure. */
  collapsible?: boolean;
  /** Initial state for a collapsible panel. */
  defaultOpen?: boolean;
  children: ReactNode;
}

export const SurfacePanel = ({
  title,
  headerAction,
  collapsible = false,
  defaultOpen = true,
  children,
  className,
  ...props
}: SurfacePanelProps) => {
  if (collapsible) {
    return (
      <details
        className={cn(
          "rounded-[var(--radius-lg)] border border-border/70 bg-card",
          "neo-shadow hover:border-primary/35",
          "transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-250 overflow-hidden",
          className
        )}
        open={defaultOpen}
        {...(props as DetailsHTMLAttributes<HTMLDetailsElement>)}
      >
        {title || headerAction ? (
          <summary className="group flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border/60 px-5 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
            {title ? <h3 className="text-sm font-semibold tracking-tight">{title}</h3> : <span />}
            <span className="flex items-center gap-2">
              {headerAction}
              <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </span>
          </summary>
        ) : null}
        <div className="p-4 sm:p-5">{children}</div>
      </details>
    );
  }

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

