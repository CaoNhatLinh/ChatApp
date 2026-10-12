import axios from 'axios';
import { create } from "zustand";
import { disconnectWebSocket } from '@/shared/websocket/websocketService';
import { getCurrentUser, refreshAccessToken } from "@/features/auth/api/auth.api";
import type { User } from "@/features/auth/types/auth.types";
import { useFriendStore } from "@/features/relationships/model/friend.store";
import { useMessengerStore } from "@/features/messenger/model/messenger.store";
import { useNotificationStore } from "@/features/notifications/model/notification.store";
import { usePresenceStore } from "@/features/presence/model/presence.store";
import { logger } from '@/shared/lib/logger';
import { clearAccessToken, clearSessionHint, getAccessToken, getSessionGeneration, hasSessionHint, setAccessToken, SessionChangedError } from '@/shared/auth/access-token';

interface AuthState {
  user: User | null;
  loading: boolean;
  initializationError: 'unavailable' | null;
  token?: string;
  login: (token: string) => Promise<void>;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
  initializeAuth: () => Promise<void>;
}

let initAuthTask: { generation: number; promise: Promise<void> } | null = null;

const isRejectedSession = (error: unknown): boolean =>
  axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403);

const disconnectSession = () => {
  resetCrossFeatureState();
  try {
    disconnectWebSocket();
  } catch (error) {
    logger.warn('[AuthStore] disconnectWebSocket failed', error instanceof Error ? error.message : String(error));
  }
};

const resetCrossFeatureState = () => {
  useFriendStore.getState().reset();
  useMessengerStore.getState().resetState();
  usePresenceStore.getState().clearPresences();
  useNotificationStore.getState().disconnectRealtime();
  useNotificationStore.getState().resetState();
};

const applyPresencePreference = (user: User) => {
  const savedPreference = user.statusPreference;
  if (savedPreference && savedPreference !== 'ONLINE') {
    usePresenceStore.getState().setMyStatusFromServer(savedPreference);
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initializationError: null,
  token: getAccessToken(),

  login: async (token) => {
    clearAccessToken();
    disconnectSession();
    const generation = getSessionGeneration();
    setAccessToken(token);
    set({ user: null, token, loading: true, initializationError: null });
    try {
      const user = await getCurrentUser();
      if (generation !== getSessionGeneration()) throw new SessionChangedError();
      set({ user, loading: false, token: getAccessToken() });
      applyPresencePreference(user);
    } catch (error) {
      if (generation !== getSessionGeneration()) throw new SessionChangedError();
      if (isRejectedSession(error)) {
        clearAccessToken();
        clearSessionHint();
        set({ user: null, token: undefined, loading: false, initializationError: null });
        disconnectSession();
      } else {
        set({ loading: false, initializationError: 'unavailable' });
      }
      throw error;
    }
  },

  logout: () => {
    clearAccessToken();
    clearSessionHint();
    set({ user: null, token: undefined, loading: false, initializationError: null });
    disconnectSession();
  },

  updateUser: (partial) =>
    set((state) => ({
      token: state.token,
      user: state.user ? { ...state.user, ...partial } : null,
    })),

  initializeAuth: async () => {
    const generation = getSessionGeneration();
    if (initAuthTask?.generation === generation) {
      return initAuthTask.promise;
    }

    if (!getAccessToken() && !hasSessionHint()) {
      set({ user: null, loading: false, token: undefined, initializationError: null });
      disconnectSession();
      return;
    }

    const task = (async () => {
      set({ loading: true, initializationError: null });
      try {
        const token = getAccessToken() ?? await refreshAccessToken();
        if (generation !== getSessionGeneration()) return;
        setAccessToken(token);
        const user = await getCurrentUser();
        if (generation !== getSessionGeneration()) return;
        set({ user, loading: false, token: getAccessToken() });
        logger.debug('[AuthStore] user loaded from /auth/me', { hasUser: Boolean(user?.userId) });
        logger.debug('[AuthStore] status preference received', {
          hasPreference: Boolean(user.statusPreference),
        });
        applyPresencePreference(user);
      } catch (error) {
        if (generation !== getSessionGeneration()) return;
        if (isRejectedSession(error)) {
          clearAccessToken();
          clearSessionHint();
          set({ user: null, loading: false, token: undefined, initializationError: null });
          disconnectSession();
        } else {
          set({ loading: false, initializationError: 'unavailable' });
          logger.warn('[AuthStore] Session initialization is temporarily unavailable');
        }
      }
    })();

    initAuthTask = { generation, promise: task };
    try {
      await task;
    } finally {
      if (initAuthTask?.promise === task) initAuthTask = null;
    }
  },
}));
