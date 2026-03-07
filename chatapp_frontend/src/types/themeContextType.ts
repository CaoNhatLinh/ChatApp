export type ThemePreference = 'light' | 'dark' | 'system';
export interface ThemeContextType {
  themePreference: ThemePreference;
  isDarkMode: boolean;
  setThemePreference: (preference: ThemePreference) => void;
}