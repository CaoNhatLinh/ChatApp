import { Fragment } from 'react';
import { cn } from '@/shared/lib/cn';

export type BrandWordVariant = 'accent' | 'hero' | 'lockup';

interface BrandWordProps {
  className?: string;
  variant?: BrandWordVariant;
}

function NoiWordmarkSvg() {
  return (
    <svg className="brand-word-svg" viewBox="0 0 68 30" aria-hidden="true" focusable="false">
      <use href="/noi-wordmark.svg#noi-wordmark" />
    </svg>
  );
}

/** The styled Nối word used when the product name is part of visible UI copy. */
export function BrandWord({ className, variant = 'accent' }: BrandWordProps) {
  return (
    <span
      className={cn(
        'brand-word',
        variant === 'hero' && 'brand-word-hero',
        variant === 'lockup' && 'brand-word-lockup',
        className,
      )}
      role="img"
      aria-label="Nối"
    >
      <NoiWordmarkSvg />
    </span>
  );
}

interface BrandTextProps {
  text: string;
  brandClassName?: string;
  variant?: BrandWordVariant;
}

/** Replaces each exact product-name token in a translated sentence with BrandWord. */
export function BrandText({ text, brandClassName, variant = 'accent' }: BrandTextProps) {
  const segments = text.split('Nối');

  return (
    <>
      {segments.map((segment, index) => (
        <Fragment key={`${segment}-${index}`}>
          {segment}
          {index < segments.length - 1 ? <BrandWord className={brandClassName} variant={variant} /> : null}
        </Fragment>
      ))}
    </>
  );
}
