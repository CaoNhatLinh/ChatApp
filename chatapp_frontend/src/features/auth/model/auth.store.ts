// authStore.ts
import { create } from "zustand";
import { disconnectWebSocket } from '@/shared/websocket/websocketService';
import { getCurrentUser, refreshAccessToken } from "@/features/auth/api/auth.api";
import type { User } from "@/features/auth/types/auth.types";
import { useFriendStore } from "@/features/relationships/model/friend.store";
import { useMessengerStore } from "@/features/messenger/model/messenger.store";
import { useNotificationStore } from "@/features/notifications/model/notification.store";
import { usePresenceStore } from "@/features/presence/model/presence.store";
import { logger } from '@/shared/lib/logger';
import { clearAccessToken, clearSessionHint, getAccessToken, hasSessionHint, setAccessToken } from '@/shared/auth/access-token';

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
  token: getAccessToken(),

  login: async (token) => {
    setAccessToken(token);
    set({ token });
    await get().initializeAuth();
  },

  logout: () => {
    clearAccessToken();
    clearSessionHint();
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
    if (initAuthPromise) {
      return initAuthPromise;
    }

    if (!getAccessToken() && !hasSessionHint()) {
      set({ user: null, loading: false, token: undefined });
      resetCrossFeatureState();
      return;
    }

    const task = (async () => {
      set({ loading: true });
      try {
        const token = getAccessToken() ?? await refreshAccessToken();
        setAccessToken(token);
        const user = await getCurrentUser();
        set({ user, loading: false, token });
        logger.debug('[AuthStore] user loaded from /auth/me', { hasUser: Boolean(user?.userId) });
        const savedPref = user.statusPreference;
        logger.debug('[AuthStore] status preference received', { hasPreference: Boolean(savedPref) });
        if (savedPref && savedPref !== 'ONLINE') {
          usePresenceStore.getState().setMyStatusFromServer(savedPref);
        }
      } catch (error) {
        clearAccessToken();
        clearSessionHint();
        set({ user: null, loading: false, token: undefined });
        resetCrossFeatureState();
        logger.error('[AuthStore] initializeAuth failed', error instanceof Error ? error.message : String(error));
      } finally {
        initAuthPromise = null;
      }
    })();

    initAuthPromise = task;
    await task;
  },
}));

// Hook để tự động initialize khi load app
