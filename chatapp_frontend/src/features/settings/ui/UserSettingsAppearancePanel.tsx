import { Check, Monitor, Moon, Sun } from 'lucide-react';
import type { FC } from 'react';
import { Button } from '@/shared/ui/Button';
import { localizeText } from '@/shared/i18n';

type ThemePreference = 'light' | 'dark' | 'system';

interface UserSettingsAppearancePanelProps {
  themePreference: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
  canSave: boolean;
  onSave: () => void;
}

export const UserSettingsAppearancePanel: FC<UserSettingsAppearancePanelProps> = ({
  themePreference,
  onThemeChange,
  canSave,
  onSave,
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
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{localizeText('Giao diện')}</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{localizeText('Chọn chủ đề phù hợp với mắt bạn.')}</p>
      </div>

      <section aria-labelledby="settings-theme-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id="settings-theme-heading" className="text-sm font-semibold">{localizeText('Chủ đề')}</h3>
          {canSave ? <span className="text-xs text-primary">{localizeText('Có thay đổi chưa lưu')}</span> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
        {themes.map((theme) => {
          const active = themePreference === theme.value;
          return (
            <button
              key={theme.value}
              type="button"
              aria-pressed={active}
              className={`group h-auto rounded-[var(--radius-md)] border p-3 text-left transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                active ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/.2)]' : 'border-border bg-card/60 hover:border-primary/50'
              }`}
              onClick={() => onThemeChange(theme.value)}
            >
              <span
                aria-hidden="true"
                className={`relative mb-3 flex h-20 w-full items-end overflow-hidden rounded-[calc(var(--radius-md)-0.2rem)] border border-border/50 p-2 ${
                  theme.value === 'light' ? 'bg-[#f5f7fb]' : theme.value === 'dark' ? 'bg-[#101820]' : 'bg-gradient-to-br from-[#f4f6fb] via-[#182432] to-[#f45c20]'
                }`}
              >
                <span className={`absolute left-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-lg ${theme.value === 'light' ? 'bg-white text-slate-700' : 'bg-black/30 text-white'}`}>
                  {renderThemeIcon(theme.value)}
                </span>
                <span className={`ml-auto block h-5 w-16 rounded-full ${theme.value === 'light' ? 'bg-slate-900/15' : 'bg-white/20'}`} />
                <span className={`absolute bottom-2 left-2 block h-2 w-10 rounded-full ${theme.value === 'light' ? 'bg-slate-900/20' : 'bg-white/25'}`} />
              </span>
              <span className="block">
                <span className="block text-sm font-semibold">{theme.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{theme.description}</span>
              </span>
              {active ? <Check aria-hidden="true" className="mt-3 h-4 w-4 text-primary" /> : null}
            </button>
          );
        })}
        </div>
      </section>

      <div className="flex justify-end border-t border-border pt-5">
        <Button type="button" onClick={onSave} disabled={!canSave}>
          {localizeText('Lưu thay đổi')}
        </Button>
      </div>
    </div>
  );
};
