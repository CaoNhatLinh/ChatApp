import * as React from 'react';
import { cn } from '@/shared/lib/cn';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full min-h-[3.25rem] rounded-[1rem] border border-border/60 bg-background/80 px-4 py-3 text-sm leading-relaxed ring-offset-background placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-all',
        className
      )}
      {...props}
    />
  );
});

Textarea.displayName = 'Textarea';

export { Textarea };
