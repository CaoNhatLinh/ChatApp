// src/store/presenceStore.ts

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { UserPresence, PresenceResponse, OnlineStatusEvent } from '@/types/presence';
import {
  getFriendsPresence,
  getConversationPresence,
  getUserPresence,
  getBatchPresence
} from '@/api/presenceApi';
import { getErrorMessage } from '@/utils/errorHandler';

interface PresenceState {
  // Core presence data
  presences: Map<string, UserPresence>;

  // Current user's own status preference
  myStatus: 'ONLINE' | 'DND' | 'INVISIBLE';

  // Loading states
  loading: boolean;
  error: string | null;

  // Actions
  setPresence: (userId: string, presence: UserPresence) => void;
  setMultiplePresences: (presences: PresenceResponse) => void;
  updateOnlineStatus: (event: OnlineStatusEvent) => void;
  setMyStatus: (status: 'ONLINE' | 'DND' | 'INVISIBLE') => void;

  // Data fetching
  loadUserPresence: (userId: string) => Promise<UserPresence | null>;
  loadFriendsPresence: () => Promise<void>;
  loadConversationPresence: (conversationId: string) => Promise<void>;
  loadBatchPresence: (userIds: string[]) => Promise<void>;

  // Utility methods
  getPresence: (userId: string) => UserPresence | null;
  isUserOnline: (userId: string) => boolean;
  getOnlineUsers: () => string[];
  getOfflineUsers: () => string[];

  // Clear methods
  clearPresences: () => void;
  clearError: () => void;
}

export const usePresenceStore = create<PresenceState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    presences: new Map(),
    myStatus: 'ONLINE',
    loading: false,
    error: null,

    // Actions
    setPresence: (userId, presence) => {
      set(state => {
        const newPresences = new Map(state.presences);
        // Normalize: accept both `isOnline` and `online` fields
        const raw = presence as UserPresence & { online?: boolean };
        const isOnline = raw.isOnline ?? raw.online ?? false;
        const normalized: UserPresence = {
          ...raw,
          userId: raw.userId ?? userId,
          isOnline,
          status: raw.status ?? (isOnline ? 'ONLINE' : 'OFFLINE'),
          lastSeen: raw.lastSeen ?? null,
          lastActiveAgo: raw.lastActiveAgo ?? null,
        };
        newPresences.set(userId, normalized);
        return { presences: newPresences };
      });
    },

    setMultiplePresences: (presences) => {
      set(state => {
        const newPresences = new Map(state.presences);
        Object.entries(presences).forEach(([userId, rawPresence]) => {
          // Normalize: Jackson may serialize `boolean isOnline` as `online` (strips "is" prefix).
          // Accept both `isOnline` and `online` fields for maximum resilience.
          const raw = rawPresence as UserPresence & { online?: boolean };
          const isOnline = raw.isOnline ?? raw.online ?? false;
          const normalized: UserPresence = {
            ...raw,
            userId: raw.userId ?? userId,
            isOnline,
            status: raw.status ?? (isOnline ? 'ONLINE' : 'OFFLINE'),
            lastSeen: raw.lastSeen ?? null,
            lastActiveAgo: raw.lastActiveAgo ?? null,
          };
          newPresences.set(userId, normalized);
        });
        return { presences: newPresences };
      });
    },

    updateOnlineStatus: (event) => {
      set(state => {
        const isUserOnline = event.online || event.isOnline || false;
        const currentPresence = state.presences.get(event.userId);

        // Determine status from event:
        // - Backend sends 'DND' when user is DND (visible to others as DND/red)
        // - Backend sends 'OFFLINE' when user is INVISIBLE or truly offline
        // - Backend sends 'ONLINE' when user comes online
        // Frontend never receives 'INVISIBLE' directly — INVISIBLE users appear as OFFLINE to watchers
        let status: UserPresence['status'];
        const rawStatus = event.status?.toUpperCase();
        if (rawStatus === 'DND' && isUserOnline) {
          status = 'DND';
        } else if (isUserOnline) {
          status = 'ONLINE';
        } else {
          status = 'OFFLINE';
        }

        let lastSeen: string | null = null;
        let lastActiveAgo: string | null = null;
        if (!isUserOnline) {
          const offlineTimestamp = event.timestamp || currentPresence?.lastSeen;
          lastSeen = offlineTimestamp || null;
          lastActiveAgo = calculateTimeAgo(offlineTimestamp);
        }

        const updatedPresence: UserPresence = {
          ...currentPresence,
          userId: event.userId,
          isOnline: isUserOnline,
          status,
          lastSeen,
          lastActiveAgo,
        };

        const newPresences = new Map(state.presences);
        newPresences.set(event.userId, updatedPresence);
        return { presences: newPresences };
      });
    },

    setMyStatus: (status) => set({ myStatus: status }),

    // Data fetching
    loadUserPresence: async (userId) => {
      try {
        set({ loading: true, error: null });
        const presence = await getUserPresence(userId);
        if (presence) {
          get().setPresence(userId, presence);
        }
        return presence;
      } catch (error: unknown) {
        set({ error: getErrorMessage(error) });
        return null;
      } finally {
        set({ loading: false });
      }
    },

    loadFriendsPresence: async () => {
      try {
        set({ loading: true, error: null });
        const presences = await getFriendsPresence();
        get().setMultiplePresences(presences);
      } catch (error: unknown) {
        set({ error: getErrorMessage(error) });
      } finally {
        set({ loading: false });
      }
    },

    loadConversationPresence: async (conversationId) => {
      try {
        set({ loading: true, error: null });
        const presences = await getConversationPresence(conversationId);
        get().setMultiplePresences(presences);
      } catch (error: unknown) {
        set({ error: getErrorMessage(error) });
      } finally {
        set({ loading: false });
      }
    },

    loadBatchPresence: async (userIds) => {
      try {
        set({ loading: true, error: null });
        const presences = await getBatchPresence(userIds);
        get().setMultiplePresences(presences);
      } catch (error: unknown) {
        set({ error: getErrorMessage(error) });
      } finally {
        set({ loading: false });
      }
    },

    // Utility methods
    getPresence: (userId) => {
      return get().presences.get(userId) || null;
    },

    isUserOnline: (userId) => {
      const presence = get().presences.get(userId);
      if (!presence) return false;
      // Defensive: accept both `isOnline` (normalized) and `online` (raw Jackson)
      const raw = presence as UserPresence & { online?: boolean };
      return raw.isOnline ?? raw.online ?? false;
    },

    getOnlineUsers: () => {
      const { presences } = get();
      return Array.from(presences.entries())
        .filter(([, p]) => {
          const raw = p as UserPresence & { online?: boolean };
          return raw.isOnline ?? raw.online ?? false;
        })
        .map(([userId]) => userId);
    },

    getOfflineUsers: () => {
      const { presences } = get();
      return Array.from(presences.entries())
        .filter(([, p]) => {
          const raw = p as UserPresence & { online?: boolean };
          return !(raw.isOnline ?? raw.online ?? false);
        })
        .map(([userId]) => userId);
    },

    // Clear methods
    clearPresences: () => {
      set({ presences: new Map() });
    },

    clearError: () => {
      set({ error: null });
    },
  }))
);

// Helper function
const calculateTimeAgo = (timestamp: string | null | undefined): string => {
  if (!timestamp) return '';
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = Math.floor((now - time) / 1000);
  if (diff < 60) return 'Vừa mới';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
};

export const usePresence = (userId?: string) => {
  const presence = usePresenceStore(state =>
    userId ? state.getPresence(userId) : null
  );
  const loadPresence = usePresenceStore(state => state.loadUserPresence);

  return { presence, loadPresence };
};

export const useIsUserOnline = (userId: string) => {
  return usePresenceStore(state => state.isUserOnline(userId));
};

export const useOnlineUsers = () => {
  return usePresenceStore(state => state.getOnlineUsers());
};

export const generateSessionId = (): string => {
  return 'session-' + String(Date.now()) + '-' + Math.random().toString(36).substring(2, 11);
}
