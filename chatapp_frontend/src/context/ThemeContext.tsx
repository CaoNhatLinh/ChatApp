import { useState, useEffect, useCallback } from 'react';
import type { ReactNode, FC } from 'react';
import { type ThemePreference, type ThemeContextType } from '@/types/themeContextType';
import { ThemeContext } from '@/hooks/useTheme';

const prefersDark = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

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
      console.error("Lỗi khi khởi tạo theme preference:", error instanceof Error ? error.message : error);
      return 'system';
    }
  });
  const isDarkMode = themePreference === 'dark' || (themePreference === 'system' && prefersDark());

  const setPreference = useCallback((preference: ThemePreference) => {
    setThemePreference(preference);
    if (typeof window !== 'undefined') {
      localStorage.setItem('themePreference', preference);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const html = document.documentElement;
    if (isDarkMode) {
      html.setAttribute('data-theme', 'dark');
    } else {
      html.removeAttribute('data-theme');
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (themePreference === 'system') {
        setThemePreference('system');
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);

  }, [isDarkMode, themePreference]);
  const contextValue: ThemeContextType = {
    themePreference,
    isDarkMode,
    setThemePreference: setPreference,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};