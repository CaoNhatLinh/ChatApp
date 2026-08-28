'use client';

import { Languages } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { useAppLocale } from '@/shared/i18n';

/** Compact, keyboard-accessible locale switch shared by every shell. */
export function LanguageToggle() {
  const { locale, toggleLocale } = useAppLocale();
  const nextLocale = locale === 'vi' ? 'en' : 'vi';

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleLocale}
      aria-label={locale === 'vi' ? 'Chuyển sang tiếng Anh' : 'Switch to Vietnamese'}
      title={locale === 'vi' ? 'English' : 'Tiếng Việt'}
      className="gap-1.5 rounded-full px-2.5 text-xs font-bold tracking-[0.08em]"
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      {nextLocale.toUpperCase()}
    </Button>
  );
}
