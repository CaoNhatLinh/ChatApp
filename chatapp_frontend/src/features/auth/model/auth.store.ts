// authStore.ts
import { create } from "zustand";
import { disconnectWebSocket } from '@/shared/websocket/websocketService';
import { getCurrentUser } from "@/features/auth/api/auth.api";
import type { User } from "@/features/auth/types/auth.types";
import { useFriendStore } from "@/features/relationships/model/friend.store";
import { useMessengerStore } from "@/features/messenger/model/messenger.store";
import { useNotificationStore } from "@/features/notifications/model/notification.store";
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

let initAuthPromise: Promise<void> | null = null;
let initAuthToken: string | null = null;

const resetCrossFeatureState = () => {
  useFriendStore.getState().reset();
  useMessengerStore.getState().resetState();
  usePresenceStore.getState().clearPresences();
  useNotificationStore.getState().disconnectRealtime();
  useNotificationStore.getState().resetState();
};

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
    set({ user: null, token: undefined, loading: false });
    resetCrossFeatureState();
    try {
      disconnectWebSocket();
    } catch (error) {
      logger.warn('[AuthStore] disconnectWebSocket failed during logout', error instanceof Error ? error.message : String(error));
    }
  },

  updateUser: (partial) =>
    set((state) => ({
      token: state.token,
      user: state.user ? { ...state.user, ...partial } : null,
    })),

  initializeAuth: async () => {
    const token = localStorage.getItem("token") || undefined;
    if (!token) {
      set({ loading: false, token: undefined });
      return;
    }

    const currentTokenKey = `${token}-${(get().user?.userId ?? 'anon')}`;
    if (initAuthPromise && initAuthToken === currentTokenKey) {
      return initAuthPromise;
    }

    const task = (async () => {
      set({ token, loading: true });
      try {
        const user = await getCurrentUser();
        set({ user, loading: false, token });
        logger.debug('[AuthStore] user loaded from /auth/me:', user);
        const savedPref = user.statusPreference;
        logger.debug('[AuthStore] savedPref extracted:', savedPref);
        if (savedPref && savedPref !== 'ONLINE') {
          usePresenceStore.getState().setMyStatusFromServer(savedPref);
        }
      } catch (error) {
        localStorage.removeItem("token");
        set({ user: null, loading: false, token: undefined });
        resetCrossFeatureState();
        logger.error('[AuthStore] initializeAuth failed', error instanceof Error ? error.message : String(error));
      } finally {
        initAuthPromise = null;
        initAuthToken = null;
      }
    })();

    initAuthPromise = task;
    initAuthToken = currentTokenKey;
    await task;
  },
}));

// Hook để tự động initialize khi load app
