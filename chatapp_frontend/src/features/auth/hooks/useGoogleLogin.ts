import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  exchangeGoogleToken,
  getAuthProviders,
  registerWithGoogle,
  type GoogleExchangeResponse,
} from '../api/google-auth.api';
import {
  clearFirebaseSession,
  getGoogleRedirectToken,
  isFirebaseClientConfigured,
  redirectToGoogleSignIn,
  signInWithGooglePopup,
} from '../lib/firebase-auth';
import { getGoogleAuthErrorMessage } from '../lib/auth-error';
import { safeReturnPath } from '../lib/safe-return-path';
import { useAuthStore } from '../model/auth.store';
import { logger } from '@/shared/lib/logger';

interface GoogleRegistrationDraft {
  idToken: string;
  suggestedDisplayName: string;
}

type ProviderState = 'checking' | 'enabled' | 'disabled';

const firebaseErrorCode = (error: unknown): string => {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  return typeof error.code === 'string' ? error.code : '';
};

export const useGoogleLogin = () => {
  const [providerState, setProviderState] = useState<ProviderState>('checking');
  const [registration, setRegistration] = useState<GoogleRegistrationDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completeLogin = useAuthStore((state) => state.login);
  const router = useRouter();
  const searchParams = useSearchParams();

  const enterNoi = useCallback(async (accessToken: string) => {
    await completeLogin(accessToken);
    await clearFirebaseSession().catch(() => undefined);
    router.replace(safeReturnPath(searchParams.get('from')));
  }, [completeLogin, router, searchParams]);

  const handleExchange = useCallback(async (idToken: string) => {
    const response: GoogleExchangeResponse = await exchangeGoogleToken(idToken);
    if (response.status === 'SIGNED_IN') {
      await enterNoi(response.session.token);
      return;
    }
    setRegistration({ idToken, suggestedDisplayName: response.suggestedDisplayName });
  }, [enterNoi]);

  const handleFailure = useCallback((failure: unknown) => {
    const code = firebaseErrorCode(failure);
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
    setError(getGoogleAuthErrorMessage(failure));
    logger.warn('[GoogleAuth] Sign-in did not complete', { code: code || 'canonical_auth_error' });
  }, []);

  useEffect(() => {
    if (!isFirebaseClientConfigured) {
      setProviderState('disabled');
      return;
    }
    let active = true;
    void getAuthProviders()
      .then((providers) => {
        if (active) setProviderState(providers.google.enabled ? 'enabled' : 'disabled');
      })
      .catch(() => {
        if (active) setProviderState('disabled');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (providerState !== 'enabled') return;
    let active = true;
    void getGoogleRedirectToken()
      .then(async (idToken) => {
        if (!active || !idToken) return;
        setLoading(true);
        await handleExchange(idToken);
      })
      .catch(async (failure: unknown) => {
        await clearFirebaseSession().catch(() => undefined);
        if (active) handleFailure(failure);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [handleExchange, handleFailure, providerState]);

  const startGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await handleExchange(await signInWithGooglePopup());
    } catch (failure: unknown) {
      if (firebaseErrorCode(failure) === 'auth/popup-blocked') {
        await redirectToGoogleSignIn();
        return;
      }
      await clearFirebaseSession().catch(() => undefined);
      handleFailure(failure);
    } finally {
      setLoading(false);
    }
  };

  const finishRegistration = async (input: { username: string; displayName: string }) => {
    if (!registration) return;
    setLoading(true);
    setError(null);
    try {
      const session = await registerWithGoogle({ ...input, idToken: registration.idToken });
      await enterNoi(session.token);
    } catch (failure: unknown) {
      handleFailure(failure);
    } finally {
      setLoading(false);
    }
  };

  const cancelRegistration = () => {
    setRegistration(null);
    setError(null);
    void clearFirebaseSession();
  };

  return {
    isAvailable: providerState === 'enabled',
    registration,
    loading,
    error,
    startGoogleLogin,
    finishRegistration,
    cancelRegistration,
  };
};
