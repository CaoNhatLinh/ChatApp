import type { ReactNode } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { AuthContext } from './auth-context';
import { useShallow } from 'zustand/react/shallow';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const authState = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      loading: state.loading,
      token: state.token,
      login: state.login,
      logout: state.logout,
      updateUser: state.updateUser,
      initializeAuth: state.initializeAuth,
    }))
  );

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
};
