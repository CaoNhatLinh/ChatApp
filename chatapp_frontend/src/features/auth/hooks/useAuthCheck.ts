import { useEffect } from 'react';
import { logger } from '@/shared/lib/logger';
import { useAuthStore } from '@/features/auth/model/auth.store';

const toBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return padded;
};

const getTokenExpiration = (token: string): number | null => {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;

    const decoded = JSON.parse(atob(toBase64Url(payload))) as { exp?: number };
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
};

export const useAuthCheck = () => {
  const { token, user, logout } = useAuthStore();

  useEffect(() => {
    if (token && !user) {
      logger.warn('Token exists but no user found - token may be expired');
    }

    if (token) {
      const exp = getTokenExpiration(token);
      if (exp === null) {
        logger.error('Error parsing token');
        logout();
        return;
      }

      const currentTime = Date.now() / 1000;
      if (exp < currentTime) {
        logger.error('Token expired, logging out');
        logout();
      }
    }
  }, [token, user, logout]);
};
