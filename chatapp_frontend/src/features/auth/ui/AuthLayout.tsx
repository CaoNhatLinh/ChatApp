import type { ReactNode } from "react";
import AuthShellHeader from "@/route-pages/shared/layout/AuthShellHeader";
import { ShellFrame } from "@/route-pages/shared/layout/ShellFrame";
import { SignalThread } from '@/route-pages/shared/landing/SignalThread';
import { localizeText } from '@/shared/i18n';
import { BrandWord } from '@/shared/ui/BrandWord';

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export const AuthLayout = ({ children, title, subtitle }: AuthLayoutProps) => {
  return (
    <ShellFrame ambient="normal" className="auth-shell w-full px-4 py-24 sm:px-6 sm:py-28">
      <AuthShellHeader />
      <div className="auth-stage relative z-10 mx-auto grid w-full max-w-6xl overflow-hidden border-y border-border lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="auth-signal-field" aria-label={localizeText('Tín hiệu dẫn vào Nối')}>
          <SignalThread variant="wave" className="auth-signal-thread" />
          <div className="auth-signal-orbit" aria-hidden="true"><i /><i /><i /></div>
          <div className="auth-signal-copy">
            <p>{localizeText('Một đường truyền riêng')}</p>
            <h2>{localizeText('Vào đúng chỗ. Nói đúng người.')}</h2>
            <span><BrandWord /> {localizeText('giữ cuộc trò chuyện ở đúng ngữ cảnh.')}</span>
          </div>
        </aside>
        <div className="auth-form-surface p-6 sm:p-8 md:p-12">
          <div className="space-y-2">
            {title ? <h1 className="text-3xl font-bold tracking-[-0.03em]">{title}</h1> : null}
            {subtitle ? <p className="text-sm leading-6 text-muted-foreground max-w-prose">{subtitle}</p> : null}
          </div>

          <div className="mt-8">{children}</div>
        </div>
      </div>
    </ShellFrame>
  );
};

export default AuthLayout;
