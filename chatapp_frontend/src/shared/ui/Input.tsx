import * as React from 'react';
import { cn } from '@/shared/lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  type?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'h-10 w-full rounded-[var(--radius-md)] border border-border bg-background px-3.5 py-2.5 text-sm',
        'file:border-0 file:bg-transparent file:text-sm file:font-semibold',
        'placeholder:text-muted-foreground/75',
        'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-55',
        'transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200',
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };

