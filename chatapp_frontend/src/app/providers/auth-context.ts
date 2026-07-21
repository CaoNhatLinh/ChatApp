import { createContext } from 'react';
import { type useAuthStore } from '@/features/auth/model/auth.store';

export type AuthContextValue = ReturnType<typeof useAuthStore.getState> | null;

export const AuthContext = createContext<AuthContextValue>(null);
