'use client';

import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { LocaleContext } from './context';

export function useAppLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useAppLocale must be used inside AppI18nProvider');
  return context;
}

export function useAppTranslation() {
  const { t } = useTranslation();
  const { locale, setLocale, toggleLocale } = useAppLocale();
  return { t, locale, setLocale, toggleLocale };
}
