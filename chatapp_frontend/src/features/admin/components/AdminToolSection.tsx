import type { ReactNode } from 'react';
import { Activity, ChevronDown, Eye, History, ShieldAlert } from 'lucide-react';

const toolIcons = { audit: History, activity: Activity, message: Eye, sanction: ShieldAlert };

interface AdminToolSectionProps {
  kind: keyof typeof toolIcons;
  title: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function AdminToolSection({ kind, title, open, onOpenChange, children }: AdminToolSectionProps) {
  const Icon = toolIcons[kind];

  return (
    <details
      className="group/tool min-w-0"
      open={open}
      onToggle={onOpenChange ? event => onOpenChange(event.currentTarget.open) : undefined}
    >
      <summary className="focus-ring relative isolate flex min-h-14 cursor-pointer list-none items-center gap-3 overflow-hidden rounded-xl px-3 py-2 transition-colors hover:bg-accent group-open/tool:bg-accent/65 sm:px-4 [&::-webkit-details-marker]:hidden">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-primary">
          <Icon size={18} aria-hidden="true" />
        </span>
        <h3 className="relative flex-1 text-sm font-semibold sm:text-base">{title}</h3>
        <svg viewBox="0 0 140 64" fill="none" aria-hidden="true" className="pointer-events-none absolute -z-10 right-6 h-16 w-24 text-primary opacity-15 sm:w-36 motion-safe:transition-transform motion-safe:group-hover/tool:-translate-x-2">
          {kind === 'audit' || kind === 'activity' ? (
            <>
              <path d="M0 48h29l10-12 10 4 16-22 12 26 16-12h47M18 52h122M43 14h97" stroke="currentColor" />
              <circle cx="65" cy="18" r="3" fill="currentColor" />
              <circle cx="93" cy="32" r="3" fill="currentColor" />
            </>
          ) : (
            <>
              <ellipse cx="101" cy="32" rx="34" ry="18" stroke="currentColor" />
              <circle cx="101" cy="32" r="8" stroke="currentColor" />
              <path d="M0 32h140M101 0v64" stroke="currentColor" strokeDasharray="3 4" />
            </>
          )}
        </svg>
        <ChevronDown size={17} aria-hidden="true" className="shrink-0 text-muted-foreground group-open/tool:rotate-180 motion-safe:transition-transform" />
      </summary>
      <div className="min-w-0 px-3 pt-4 pb-5 sm:px-4">{children}</div>
    </details>
  );
}
