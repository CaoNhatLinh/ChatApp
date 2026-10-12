import { useEffect } from 'react';
import { localizeText } from '@/shared/i18n';
import { useGoogleLogin } from '../hooks/useGoogleLogin';
import { GoogleRegistrationForm } from './GoogleRegistrationForm';
import { GoogleSignInButton } from './GoogleSignInButton';

interface GoogleAuthPanelProps {
  onOnboardingChange?: (active: boolean) => void;
}

export const GoogleAuthPanel = ({ onOnboardingChange }: GoogleAuthPanelProps) => {
  const google = useGoogleLogin();

  useEffect(() => {
    onOnboardingChange?.(Boolean(google.registration));
  }, [google.registration, onOnboardingChange]);

  if (!google.isAvailable) return null;

  return (
    <section aria-label={localizeText('Đăng nhập bằng Google')} className="space-y-4">
      {google.registration ? (
        <GoogleRegistrationForm
          suggestedDisplayName={google.registration.suggestedDisplayName}
          loading={google.loading}
          onSubmit={(input) => void google.finishRegistration(input)}
          onCancel={google.cancelRegistration}
        />
      ) : (
        <>
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-semibold text-muted-foreground">{localizeText('hoặc')}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <GoogleSignInButton loading={google.loading} onClick={() => void google.startGoogleLogin()} />
        </>
      )}
      {google.error ? (
        <p role="alert" className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {google.error}
        </p>
      ) : null}
    </section>
  );
};
