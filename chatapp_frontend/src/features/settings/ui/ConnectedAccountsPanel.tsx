import { useEffect, useState } from 'react';
import { Check, KeyRound } from 'lucide-react';
import {
  getAuthProviders,
  getConnectedIdentities,
  linkGoogleIdentity,
  type ConnectedIdentities,
} from '@/features/auth/api/google-auth.api';
import { getGoogleAuthErrorMessage } from '@/features/auth/lib/auth-error';
import {
  clearFirebaseSession,
  isFirebaseClientConfigured,
  signInWithGooglePopup,
} from '@/features/auth/lib/firebase-auth';
import { localizeText } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';

type PanelState = 'loading' | 'ready' | 'unavailable';

const firebaseErrorCode = (error: unknown): string => {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  return typeof error.code === 'string' ? error.code : '';
};

export const ConnectedAccountsPanel = () => {
  const [panelState, setPanelState] = useState<PanelState>('loading');
  const [identities, setIdentities] = useState<ConnectedIdentities | null>(null);
  const [password, setPassword] = useState('');
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseClientConfigured) {
      setPanelState('unavailable');
      return;
    }
    let active = true;
    void Promise.all([getAuthProviders(), getConnectedIdentities()])
      .then(([providers, connected]) => {
        if (!active) return;
        setIdentities(connected);
        setPanelState(providers.google.enabled ? 'ready' : 'unavailable');
      })
      .catch(() => {
        if (active) setPanelState('unavailable');
      });
    return () => { active = false; };
  }, []);

  const linkGoogle = async () => {
    if (!password.trim()) {
      setError(localizeText('Nhập mật khẩu hiện tại để xác nhận đây là tài khoản của bạn.'));
      return;
    }
    setLinking(true);
    setError(null);
    try {
      const idToken = await signInWithGooglePopup();
      setIdentities(await linkGoogleIdentity({ idToken, currentPassword: password }));
      setPassword('');
    } catch (failure: unknown) {
      const code = firebaseErrorCode(failure);
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(getGoogleAuthErrorMessage(failure));
      }
    } finally {
      await clearFirebaseSession().catch(() => undefined);
      setLinking(false);
    }
  };

  if (panelState === 'loading') {
    return <p role="status" className="text-sm text-muted-foreground">{localizeText('Đang đọc các cách đăng nhập...')}</p>;
  }

  if (panelState === 'unavailable') {
    return (
      <div className="border-l-2 border-border pl-4">
        <h3 className="font-semibold text-foreground">{localizeText('Google chưa được kết nối')}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {localizeText('Quản trị viên cần cấu hình Firebase trước khi bạn có thể dùng cách đăng nhập này.')}
        </p>
      </div>
    );
  }

  if (identities?.google.linked) {
    return (
      <div className="flex items-start gap-3 border-l-2 border-emerald-500 pl-4">
        <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"><Check size={17} /></span>
        <div>
          <h3 className="font-semibold text-foreground">{localizeText('Google đã được nối')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{identities.google.email}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {localizeText('Bạn có thể dùng Google hoặc mật khẩu để vào đúng tài khoản này.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-primary">{localizeText('Thêm một lối vào')}</p>
        <h3 className="mt-1 text-xl font-bold tracking-tight text-foreground">{localizeText('Nối tài khoản Google')}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {localizeText('Xác nhận mật khẩu Nối, rồi chọn Google có cùng địa chỉ email.')}
        </p>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-foreground">{localizeText('Mật khẩu hiện tại')}</span>
        <span className="relative block">
          <KeyRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={linking}
            className="pl-10"
          />
        </span>
      </label>
      <Button type="button" loading={linking} onClick={() => void linkGoogle()}>
        {localizeText(linking ? 'Đang xác minh...' : 'Chọn tài khoản Google')}
      </Button>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
};
