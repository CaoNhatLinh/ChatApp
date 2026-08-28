import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-semibold tracking-tight ring-offset-background transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55 disabled:cursor-not-allowed active:translate-y-[1px]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground hover:border-primary/35',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/85 border border-border/50',
        ghost: 'bg-transparent hover:bg-accent/50 hover:text-accent-foreground',
        glass:
          'bg-card/65 border border-border/40 hover:bg-card/85',
        subtle:
          'bg-transparent border border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-card/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-9 rounded-lg px-3.5',
        lg: 'h-11 rounded-[0.95rem] px-6',
        icon: 'h-10 w-10 rounded-xl',
        xl: 'h-11 rounded-[1rem] px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export type ButtonVariantsType = VariantProps<typeof buttonVariants>;

