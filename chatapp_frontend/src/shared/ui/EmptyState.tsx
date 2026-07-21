import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-card/90 text-muted-foreground shadow-sm">
        {icon}
      </div>
      <h3 className="text-sm font-black uppercase tracking-[0.12em] text-foreground">{title}</h3>
      {description ? <p className="mt-2 text-sm text-muted-foreground max-w-sm leading-6">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
};
