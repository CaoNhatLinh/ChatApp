import { Monitor, Moon, Sun } from 'lucide-react';
import type { FC } from 'react';
import { Button } from '@/shared/ui/Button';
import { localizeText } from '@/shared/i18n';

type ThemePreference = 'light' | 'dark' | 'system';

interface UserSettingsAppearancePanelProps {
  themePreference: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
}

export const UserSettingsAppearancePanel: FC<UserSettingsAppearancePanelProps> = ({
  themePreference,
  onThemeChange,
}) => {
  const themes: Array<{ value: ThemePreference; label: string; description: string }> = [
    { value: 'light', label: localizeText('Sáng'), description: localizeText('Giao diện nền sáng, dễ đọc ban ngày.') },
    { value: 'dark', label: localizeText('Tối'), description: localizeText('Giảm mỏi mắt khi dùng đêm.') },
    { value: 'system', label: localizeText('Theo hệ thống'), description: localizeText('Tự đồng bộ theo cấu hình máy.') },
  ];

  const renderThemeIcon = (theme: ThemePreference) => {
    if (theme === 'light') return <Sun size={28} />;
    if (theme === 'dark') return <Moon size={28} />;
    return <Monitor size={28} />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{localizeText('Giao diện')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{localizeText('Chọn chủ đề phù hợp với mắt bạn.')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {themes.map((theme) => {
          const active = themePreference === theme.value;
          return (
            <Button
              key={theme.value}
              type="button"
              variant={active ? 'default' : 'outline'}
              className="h-auto flex-col items-start gap-4 rounded-[var(--radius-md)] px-4 py-5 text-left"
              onClick={() => onThemeChange(theme.value)}
            >
              <span className="inline-flex items-center justify-center rounded-xl border border-border/50 p-3">
                {renderThemeIcon(theme.value)}
              </span>
              <span>
                <span className="block text-sm font-semibold">{theme.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{theme.description}</span>
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
