import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import type { ReactNode, FC } from 'react';
import { ThemeContext, type ThemeContextType, type ThemePreference } from '@/app/providers/theme';
import { logger } from '@/shared/lib/logger';

const prefersDark = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

const subscribeToSystemTheme = (onChange: () => void): (() => void) => {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: FC<ThemeProviderProps> = ({ children }) => {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedTheme = localStorage.getItem('themePreference');
        return (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system')
          ? storedTheme
          : 'system';
      }
      return 'system';
    } catch (error) {
      logger.warn('[ThemeProvider] Failed to initialize theme preference', error instanceof Error ? error.message : String(error));
      return 'system';
    }
  });
  const systemIsDark = useSyncExternalStore(subscribeToSystemTheme, prefersDark, () => false);
  const isDarkMode = themePreference === 'dark' || (themePreference === 'system' && systemIsDark);

  const setPreference = useCallback((preference: ThemePreference) => {
    setThemePreference(preference);
    if (typeof window !== 'undefined') {
      localStorage.setItem('themePreference', preference);
    }
  }, []);

  const previewPreference = useCallback((preference: ThemePreference) => {
    setThemePreference(preference);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const html = document.documentElement;
    if (isDarkMode) {
      html.setAttribute('data-theme', 'dark');
    } else {
      html.removeAttribute('data-theme');
    }
  }, [isDarkMode]);

  const contextValue: ThemeContextType = {
    themePreference,
    isDarkMode,
    previewThemePreference: previewPreference,
    setThemePreference: setPreference,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};
