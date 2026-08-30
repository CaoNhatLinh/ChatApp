import { cn } from '@/shared/lib/cn';

interface BrandMarkProps {
  className?: string;
  imageClassName?: string;
  label?: string;
}

export function BrandMark({ className, imageClassName, label }: BrandMarkProps) {
  return (
    <span className={cn('brand-mark overflow-hidden p-0.5', className)} aria-label={label}>
      <img
        src="/noi-mark.svg"
        alt=""
        aria-hidden={label ? undefined : true}
        className={cn('h-full w-full object-contain', imageClassName)}
      />
    </span>
  );
}

interface BrandLockupProps {
  title?: string;
  className?: string;
  markClassName?: string;
}

export function BrandLockup({ title = 'Nối', className, markClassName }: BrandLockupProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BrandMark className={markClassName} />
      <span>{title}</span>
    </span>
  );
}
