'use client';

import { Languages } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { useAppTranslation } from '@/shared/i18n';

/** Compact, keyboard-accessible locale switch shared by every shell. */
export function LanguageToggle() {
  const { t, locale, toggleLocale } = useAppTranslation();
  const nextLocale = locale === 'vi' ? 'en' : 'vi';

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleLocale}
      aria-label={`${nextLocale.toUpperCase()} — ${t(locale === 'vi' ? 'Chuyển sang tiếng Anh' : 'Chuyển sang tiếng Việt')}`}
      title={t(nextLocale === 'en' ? 'Tiếng Anh' : 'Tiếng Việt')}
      className="gap-1.5 rounded-full px-2.5 text-xs font-bold tracking-[0.08em]"
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      {nextLocale.toUpperCase()}
    </Button>
  );
}
