'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, Languages, ShieldCheck } from 'lucide-react';
import { ShellFrame } from './ShellFrame';
import { BrandLockup } from '@/shared/ui/Brand';
import { Button } from '@/shared/ui/Button';
import { ThemeToggle } from '@/features/settings/ui/ThemeToggle';
import { localizeText, useAppLocale } from '@/shared/i18n';

interface AdminPageShellProps {
  children: ReactNode;
  onBackToApp: () => void;
}

export function AdminPageShell({ children, onBackToApp }: AdminPageShellProps) {
  const { locale, toggleLocale } = useAppLocale();
  const languageLabel = locale === 'vi' ? localizeText('Chuyển sang tiếng Anh') : localizeText('Chuyển sang tiếng Việt');

  return (
    <ShellFrame ambient="subtle" className="admin-shell">
      <header className="admin-shell-header">
        <div className="admin-shell-header-inner">
          <div className="admin-shell-identity">
            <BrandLockup markClassName="h-9 w-9" />
            <span aria-hidden="true" />
            <strong>{localizeText('Quản trị toàn cục')}</strong>
          </div>
          <div className="admin-shell-actions">
            <span className="admin-shell-scope"><ShieldCheck size={15} aria-hidden="true" />{localizeText('Cấp ứng dụng')}</span>
            <button type="button" className="admin-shell-icon-button" aria-label={languageLabel} title={languageLabel} onClick={toggleLocale}>
              <Languages size={17} aria-hidden="true" />
              <span>{locale === 'vi' ? 'EN' : 'VI'}</span>
            </button>
            <ThemeToggle />
            <Button type="button" size="sm" variant="outline" onClick={onBackToApp} className="admin-shell-exit">
              <ArrowLeft size={15} aria-hidden="true" />
              <span>{localizeText('Về ứng dụng')}</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="admin-shell-content layout-shell">{children}</main>
    </ShellFrame>
  );
}

export default AdminPageShell;
