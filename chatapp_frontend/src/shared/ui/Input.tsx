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
        'h-10 w-full rounded-[0.85rem] border border-border/70 bg-background/90 px-3.5 py-2.5 text-sm',
        'file:border-0 file:bg-transparent file:text-sm file:font-semibold',
        'placeholder:text-muted-foreground/75',
        'focus-visible:outline-none focus-visible:border-primary/80 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-55',
        'transition-all duration-200',
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
