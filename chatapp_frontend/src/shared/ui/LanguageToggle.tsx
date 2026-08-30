'use client';

import { Check, Languages } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu';
import { useAppTranslation } from '@/shared/i18n';

interface LanguageToggleProps {
  tone?: 'default' | 'workspace';
}

/** Compact, keyboard-accessible locale switch shared by every shell. */
export function LanguageToggle({ tone = 'default' }: LanguageToggleProps) {
  const { t, locale, setLocale } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), 140);
  };

  const chooseLocale = (nextLocale: 'vi' | 'en') => {
    setLocale(nextLocale);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('Ngôn ngữ')}
          title={t('Ngôn ngữ')}
          className="rounded-full"
          onPointerEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onPointerLeave={scheduleClose}
        >
          <Languages className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        className={`w-44 ${tone === 'workspace' ? 'messenger-workspace' : ''}`}
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
      >
        <DropdownMenuLabel>{t('Ngôn ngữ')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => chooseLocale('vi')}>
          <span>{t('Tiếng Việt')}</span>
          {locale === 'vi' ? <Check className="ml-auto h-4 w-4 text-primary" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => chooseLocale('en')}>
          <span>{t('Tiếng Anh')}</span>
          {locale === 'en' ? <Check className="ml-auto h-4 w-4 text-primary" /> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
