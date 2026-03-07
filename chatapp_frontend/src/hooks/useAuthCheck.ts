import { useEffect } from 'react';
import { logger } from '@/common/lib/logger';
import { useAuthStore } from '@/store/authStore';

export const useAuthCheck = () => {
  const { token, user, logout } = useAuthStore();

  useEffect(() => {
    if (token && !user) {
      logger.warn('Token exists but no user found - token may be expired');
    }

    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
        const currentTime = Date.now() / 1000;

        if (decoded.exp && decoded.exp < currentTime) {
          logger.error('Token expired, logging out');
          logout();
        }
      } catch (error) {
        logger.error('Error parsing token:', error instanceof Error ? error.message : String(error));
        logout();
      }
    }
  }, [token, user, logout]);
};
