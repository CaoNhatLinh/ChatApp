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
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border border-border bg-card text-muted-foreground shadow-sm">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? <p className="mt-2 text-sm text-muted-foreground max-w-sm leading-6">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
};
