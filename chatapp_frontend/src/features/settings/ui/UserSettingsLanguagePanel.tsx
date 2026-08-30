import { Check, Globe2 } from 'lucide-react';
import type { FC } from 'react';
import { localizeText, type AppLocale } from '@/shared/i18n';

interface UserSettingsLanguagePanelProps {
  locale: AppLocale;
  onLocaleChange: (value: AppLocale) => void;
}

export const UserSettingsLanguagePanel: FC<UserSettingsLanguagePanelProps> = ({
  locale,
  onLocaleChange,
}) => (
  <div className="space-y-8">
    <div>
      <div className="flex items-center gap-2">
        <Globe2 size={20} aria-hidden="true" />
        <h2 className="text-2xl font-semibold tracking-tight">{localizeText('Ngôn ngữ')}</h2>
      </div>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        {localizeText('Chọn ngôn ngữ hiển thị trong ứng dụng.')}
      </p>
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      {([
        ['vi', localizeText('Tiếng Việt')],
        ['en', localizeText('Tiếng Anh')],
      ] as const).map(([value, label]) => {
        const active = locale === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onLocaleChange(value)}
            className={`flex items-center justify-between rounded-[var(--radius-md)] border px-4 py-4 text-left text-sm font-semibold transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${active ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/.2)]' : 'border-border bg-card/60 hover:border-primary/50'}`}
          >
            <span>
              <span className="block">{label}</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">{value === 'vi' ? 'VI' : 'EN'}</span>
            </span>
            {active ? <Check aria-hidden="true" className="h-4 w-4 text-primary" /> : null}
          </button>
        );
      })}
    </div>
  </div>
);

export default UserSettingsLanguagePanel;
