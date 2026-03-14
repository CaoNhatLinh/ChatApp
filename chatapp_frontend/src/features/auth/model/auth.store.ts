// authStore.ts
import { create } from "zustand";
import { getCurrentUser } from "@/features/auth/api/auth.api";
import type { User } from "@/features/auth/types/auth.types";
import { usePresenceStore } from "@/features/presence/model/presence.store";
import { logger } from '@/shared/lib/logger';

interface AuthState {
  user: User | null;
  loading: boolean;
  token?: string;
  login: (token: string) => Promise<void>;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  token: localStorage.getItem("token") || undefined,

  login: async (token) => {
    localStorage.setItem("token", token);
    set({ token });
    await get().initializeAuth();
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ user: null, token: undefined });
  },

  updateUser: (partial) =>
    set((state) => ({
      token: state.token,
      user: state.user ? { ...state.user, ...partial } : null,
    })),

  initializeAuth: async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ loading: false, token: undefined });
      return;
    }

    try {
      set({ token });
      const user = await getCurrentUser();
      set({ user, loading: false, token });
      // Init myStatus từ statusPreference lưu trong DB (ONLINE/DND/INVISIBLE)
      // Server sẽ restore vào Redis khi WebSocket connect,
      // nhưng UI cần biết trước để render đúng StatusSelector
      const savedPref = user.statusPreference;
      logger.debug('[AuthStore] user loaded from /auth/me:', user);
      logger.debug('[AuthStore] savedPref extracted:', savedPref);
      if (savedPref && savedPref !== 'ONLINE') {
        usePresenceStore.getState().setMyStatus(savedPref);
      }
    } catch {
      localStorage.removeItem("token");
      set({ user: null, loading: false, token: undefined });
    }
  },
}));

// Hook để tự động initialize khi load app
