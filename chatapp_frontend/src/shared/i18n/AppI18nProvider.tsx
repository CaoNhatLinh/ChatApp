'use client';

import { I18nextProvider } from 'react-i18next';
import { useMemo, useEffect, useState, type ReactNode } from 'react';
import type { AppLocale } from './resources';
import { LocaleContext } from './context';
import { getStoredLocale, i18n, persistLocale, setRuntimeLocale } from './runtime';

export function AppI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('vi');

  useEffect(() => {
    const nextLocale = getStoredLocale();
    setRuntimeLocale(nextLocale);
    setLocaleState(nextLocale);
    document.documentElement.lang = nextLocale;
  }, []);

  const setLocale = (nextLocale: AppLocale) => {
    setRuntimeLocale(nextLocale);
    persistLocale(nextLocale);
    document.documentElement.lang = nextLocale;
    setLocaleState(nextLocale);
  };

  const value = useMemo(() => ({
    locale,
    setLocale,
    toggleLocale: () => setLocale(locale === 'vi' ? 'en' : 'vi'),
  }), [locale]);

  return (
    <LocaleContext.Provider value={value}>
      <I18nextProvider i18n={i18n} defaultNS="translation">
        {children}
      </I18nextProvider>
    </LocaleContext.Provider>
  );
}
