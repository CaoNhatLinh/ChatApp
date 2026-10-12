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

  const selectedTheme = themes.find((theme) => theme.value === themePreference) ?? themes[2];

  return (
    <div className="space-y-6">
      <div className="max-w-lg">
        <h2 className="text-2xl font-semibold tracking-tight">{localizeText('Không gian của bạn')}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{localizeText('Xem trước toàn bộ không gian trước khi lưu. Tin nhắn và dữ liệu không thay đổi.')}</p>
      </div>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]" aria-labelledby="settings-theme-heading">
        <div className={`theme-workbench theme-preview-${themePreference} relative min-h-72 overflow-hidden rounded-[var(--radius-lg)] border border-border/60 p-5`}>
          <div className="relative z-10 flex items-center justify-between">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-current/15 bg-background/20 backdrop-blur" aria-hidden="true">
              {renderThemeIcon(themePreference)}
            </span>
            {canSave ? <span className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{localizeText('Bản nháp')}</span> : null}
          </div>
          <div className="relative z-10 mt-14 space-y-3" aria-hidden="true">
            <span className="block h-3 w-24 rounded-full bg-current/15" />
            <span className="block h-12 w-[78%] rounded-[var(--radius-md)] border border-current/10 bg-background/25" />
            <span className="ml-auto block h-12 w-[62%] rounded-[var(--radius-md)] bg-primary" />
            <span className="block h-9 w-[48%] rounded-[var(--radius-md)] border border-current/10 bg-background/20" />
          </div>
          <div className="absolute inset-x-5 bottom-5 z-10 flex items-end justify-between gap-4">
            <div><p className="text-sm font-semibold">{selectedTheme.label}</p><p className="mt-1 max-w-64 text-xs opacity-70">{selectedTheme.description}</p></div>
            <span className="h-9 w-20 rounded-[var(--radius-md)] border border-current/15 bg-background/20" aria-hidden="true" />
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 id="settings-theme-heading" className="text-sm font-semibold">{localizeText('Chủ đề ứng dụng')}</h3>
            <span className="text-xs text-muted-foreground">{localizeText('Chỉ áp dụng sau khi lưu')}</span>
          </div>
          <div className="grid gap-2">
        {themes.map((theme) => {
          const active = themePreference === theme.value;
          return (
            <button
              key={theme.value}
              type="button"
              aria-pressed={active}
              className={`group grid h-auto grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-[var(--radius-md)] border p-3 text-left transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                active ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_var(--signal-glow)]' : 'border-transparent bg-background/35 hover:border-primary/40 hover:bg-background/60'
              }`}
              onClick={() => onThemeChange(theme.value)}
            >
              <span aria-hidden="true" className={`theme-preview theme-preview-${theme.value} inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-border/50`}>
                {renderThemeIcon(theme.value)}
              </span>
              <span className="block">
                <span className="block text-sm font-semibold">{theme.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{theme.description}</span>
              </span>
              {active ? <Check aria-hidden="true" className="h-4 w-4 text-primary" /> : null}
            </button>
          );
        })}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
        <p className="text-xs leading-5 text-muted-foreground">{canSave ? localizeText('Bạn đang xem bản nháp. Lưu để áp dụng cho lần mở tiếp theo.') : localizeText('Giao diện đã được lưu.')}</p>
        <Button type="button" onClick={onSave} disabled={!canSave} className="shrink-0">
          {localizeText('Lưu thay đổi')}
        </Button>
      </div>
    </div>
  );
};
