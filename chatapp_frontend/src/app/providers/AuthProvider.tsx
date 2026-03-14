import type { ReactNode } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { AuthContext } from './auth-context';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const authState = useAuthStore();
  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
};
