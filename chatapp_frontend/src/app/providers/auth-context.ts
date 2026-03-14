import { createContext } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';

export type AuthContextValue = ReturnType<typeof useAuthStore.getState>;

export const AuthContext = createContext<AuthContextValue>(useAuthStore.getState());
