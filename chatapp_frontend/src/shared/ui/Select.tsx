import * as React from 'react';
import { cn } from '@/shared/lib/cn';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'field-control h-10 w-full rounded-[var(--radius-md)] border border-border bg-background px-3.5 text-sm',
      'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2',
      'aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20',
      'disabled:cursor-not-allowed disabled:opacity-55',
      'transition-[color,background-color,border-color,box-shadow,opacity] duration-200',
      className,
    )}
    {...props}
  />
));
Select.displayName = 'Select';

export { Select };
