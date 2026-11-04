import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/shared/lib/cn';

export const Switch = React.forwardRef<HTMLButtonElement, SwitchPrimitive.SwitchProps>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root ref={ref} className={cn('group relative inline-flex h-11 w-12 shrink-0 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50', className)} {...props}>
    <span aria-hidden="true" className="absolute left-0 h-6 w-11 rounded-full bg-muted-foreground/35 transition-colors group-data-[state=checked]:bg-primary" />
    <SwitchPrimitive.Thumb className="relative block h-[18px] w-[18px] translate-x-1 rounded-full bg-foreground transition-transform duration-150 data-[state=checked]:translate-x-6 data-[state=checked]:bg-primary-foreground motion-reduce:transition-none" />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';
