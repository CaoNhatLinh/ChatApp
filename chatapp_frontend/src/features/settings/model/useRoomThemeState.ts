import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_BUBBLE_STYLE_ID,
  DEFAULT_ROOM_THEME_ID,
  getRoomVisualComputed,
  normalizeRoomBackgroundUrl,
  type ChatBubbleStyleId,
  ROOM_THEME_PRESETS,
  ROOM_THEME_STORAGE_KEY,
  type RoomThemeId,
  type RoomVisualSettingsState,
  type RoomVisualComputed,
} from '@/features/settings/constants/chat-theme.constants';
import {
  getChatAppearancePreferences,
  resetConversationAppearancePreference,
  saveChatAppearancePreferences,
  saveConversationAppearancePreference,
} from '@/features/settings/api/chat-appearance.api';
import { logger } from '@/shared/lib/logger';

const EMPTY_ROOM_VISUAL_SETTINGS: RoomVisualSettingsState = {
  defaultRoomThemeId: DEFAULT_ROOM_THEME_ID,
  messageBubbleStyle: DEFAULT_BUBBLE_STYLE_ID,
  roomThemes: {},
};

const isRoomThemeId = (candidate: string | undefined): candidate is RoomThemeId => {
  return ROOM_THEME_PRESETS.some((preset) => preset.id === candidate);
};

const isBubbleStyleId = (candidate: string | undefined): candidate is ChatBubbleStyleId => {
  return candidate === 'tiktok' || candidate === 'glass' || candidate === 'classic';
};

const normalizeThemeState = (raw: string | null): RoomVisualSettingsState => {
  if (!raw) return EMPTY_ROOM_VISUAL_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<RoomVisualSettingsState>;
    const defaultRoomThemeId = isRoomThemeId(parsed?.defaultRoomThemeId)
      ? parsed.defaultRoomThemeId
      : DEFAULT_ROOM_THEME_ID;
    const messageBubbleStyle = isBubbleStyleId(parsed?.messageBubbleStyle)
      ? parsed.messageBubbleStyle
      : DEFAULT_BUBBLE_STYLE_ID;
    const roomThemes =
      typeof parsed.roomThemes === 'object' && parsed.roomThemes !== null
        ? Object.entries(parsed.roomThemes).reduce<RoomVisualSettingsState['roomThemes']>((acc, [conversationId, value]) => {
            if (!conversationId) return acc;

            const typedValue = value as {
              roomThemeId?: string;
              customBackgroundImage?: string;
            };

            const roomThemeId = isRoomThemeId(typedValue?.roomThemeId)
              ? typedValue.roomThemeId
              : undefined;

            let customBackgroundImage: string | undefined;
            try {
              customBackgroundImage = normalizeRoomBackgroundUrl(typedValue?.customBackgroundImage) ?? undefined;
            } catch {
              customBackgroundImage = undefined;
            }

            if (!roomThemeId && !customBackgroundImage) {
              return acc;
            }

            acc[conversationId] = {
              roomThemeId,
              customBackgroundImage,
            };
            return acc;
          }, {})
        : {};

    return {
      defaultRoomThemeId,
      messageBubbleStyle,
      roomThemes,
    };
  } catch {
    return EMPTY_ROOM_VISUAL_SETTINGS;
  }
};

const getRoomVisualStorageKey = (userId: string | null): string | null => (
  userId ? `${ROOM_THEME_STORAGE_KEY}:${userId}` : null
);

const getPersistedRoomVisualSettings = (userId: string | null): RoomVisualSettingsState => {
  const storageKey = getRoomVisualStorageKey(userId);
  if (typeof window === 'undefined' || !storageKey) return EMPTY_ROOM_VISUAL_SETTINGS;

  const rawSettings = localStorage.getItem(storageKey);
  return normalizeThemeState(rawSettings);
};

const persistRoomVisualSettings = (storageKey: string | null, settings: RoomVisualSettingsState) => {
  if (typeof window === 'undefined' || !storageKey) return;

  localStorage.setItem(storageKey, JSON.stringify(settings));
};

export const useRoomThemeState = (conversationId: string | null, userId: string | null) => {
  const storageKey = useMemo(() => getRoomVisualStorageKey(userId), [userId]);
  const hasUserInteractedRef = useRef(false);
  const [settings, setSettings] = useState<RoomVisualSettingsState>(() =>
    getPersistedRoomVisualSettings(userId),
  );

  useEffect(() => {
    hasUserInteractedRef.current = false;
    setSettings(getPersistedRoomVisualSettings(userId));
    if (!userId) return;

    let active = true;
    void getChatAppearancePreferences()
      .then((remote) => {
        if (!active || hasUserInteractedRef.current) return;
        const remoteRoomThemes = remote.rooms.reduce<RoomVisualSettingsState['roomThemes']>((acc, room) => {
          const customBackgroundImage = room.customBackgroundUrl?.trim() || undefined;
          acc[room.conversationId] = {
            roomThemeId: room.themeId,
            customBackgroundImage,
          };
          return acc;
        }, {});
        const next: RoomVisualSettingsState = {
          defaultRoomThemeId: remote.defaultThemeId,
          messageBubbleStyle: remote.defaultBubbleStyleId,
          roomThemes: remoteRoomThemes,
        };
        persistRoomVisualSettings(getRoomVisualStorageKey(userId), next);
        setSettings(next);
      })
      .catch((error: unknown) => {
        logger.warn('[RoomTheme] Failed to load server preferences', error instanceof Error ? error.message : String(error));
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const syncDefaults = useCallback((next: RoomVisualSettingsState) => {
    if (!userId) return;
    void saveChatAppearancePreferences(next.defaultRoomThemeId, next.messageBubbleStyle).catch((error: unknown) => {
      logger.warn('[RoomTheme] Failed to save default preferences', error instanceof Error ? error.message : String(error));
    });
  }, [userId]);

  const syncConversation = useCallback((conversationIdToSync: string, next: RoomVisualSettingsState) => {
    if (!userId) return;
    const override = next.roomThemes[conversationIdToSync];
    const themeId = override?.roomThemeId ?? next.defaultRoomThemeId;
    void saveConversationAppearancePreference(
      conversationIdToSync,
      themeId,
      override.customBackgroundImage ?? null,
    ).catch((error: unknown) => {
      logger.warn('[RoomTheme] Failed to save room preference', error instanceof Error ? error.message : String(error));
    });
  }, [userId]);

  const resetSyncedConversation = useCallback((conversationIdToReset: string) => {
    if (!userId) return;
    void resetConversationAppearancePreference(conversationIdToReset).catch((error: unknown) => {
      logger.warn('[RoomTheme] Failed to reset room preference', error instanceof Error ? error.message : String(error));
    });
  }, [userId]);

  const computed = useMemo<RoomVisualComputed>(
    () => getRoomVisualComputed(settings, conversationId),
    [conversationId, settings],
  );

  const activeRoomThemeId =
    conversationId && settings.roomThemes[conversationId]?.roomThemeId
      ? settings.roomThemes[conversationId].roomThemeId
      : settings.defaultRoomThemeId;

  const activeConversationBackground = conversationId
    ? settings.roomThemes[conversationId]?.customBackgroundImage
    : undefined;

  const setDefaultRoomTheme = useCallback((themeId: RoomThemeId) => {
    hasUserInteractedRef.current = true;
    setSettings((current) => {
      const next: RoomVisualSettingsState = {
        ...current,
        defaultRoomThemeId: themeId,
      };

      persistRoomVisualSettings(storageKey, next);
      syncDefaults(next);
      return next;
    });
  }, [storageKey, syncDefaults]);

  const setRoomBubbleStyle = useCallback((bubbleStyle: ChatBubbleStyleId) => {
    hasUserInteractedRef.current = true;
    setSettings((current) => {
      const next: RoomVisualSettingsState = {
        ...current,
        messageBubbleStyle: bubbleStyle,
      };

      persistRoomVisualSettings(storageKey, next);
      syncDefaults(next);
      return next;
    });
  }, [storageKey, syncDefaults]);

  const setConversationTheme = useCallback((conversationIdToSet: string, themeId: RoomThemeId) => {
    hasUserInteractedRef.current = true;
    setSettings((current) => {
      const next: RoomVisualSettingsState = {
        ...current,
        roomThemes: {
          ...current.roomThemes,
          [conversationIdToSet]: {
            ...current.roomThemes[conversationIdToSet],
            roomThemeId: themeId,
          },
        },
      };

      persistRoomVisualSettings(storageKey, next);
      syncConversation(conversationIdToSet, next);
      return next;
    });
  }, [storageKey, syncConversation]);

  const setConversationBackground = useCallback((conversationIdToSet: string, backgroundUrl: string) => {
    hasUserInteractedRef.current = true;
    const normalizedBackgroundUrl = normalizeRoomBackgroundUrl(backgroundUrl);
    setSettings((current) => {
      const next: RoomVisualSettingsState = {
        ...current,
        roomThemes: {
          ...current.roomThemes,
          [conversationIdToSet]: {
            ...current.roomThemes[conversationIdToSet],
            customBackgroundImage: normalizedBackgroundUrl ?? undefined,
          },
        },
      };

      persistRoomVisualSettings(storageKey, next);
      syncConversation(conversationIdToSet, next);
      return next;
    });
  }, [storageKey, syncConversation]);

  const resetConversationTheme = useCallback((conversationIdToReset: string) => {
    hasUserInteractedRef.current = true;
    setSettings((current) => {
      const roomThemes = { ...current.roomThemes };
      delete roomThemes[conversationIdToReset];
      const next: RoomVisualSettingsState = { ...current, roomThemes };

      persistRoomVisualSettings(storageKey, next);
      resetSyncedConversation(conversationIdToReset);
      return next;
    });
  }, [resetSyncedConversation, storageKey]);

  const clearConversationBackground = useCallback((conversationIdToClear: string) => {
    hasUserInteractedRef.current = true;
    setSettings((current) => {
      const previous = current.roomThemes[conversationIdToClear];
      if (!previous?.customBackgroundImage) return current;

      const roomThemes = { ...current.roomThemes };
      if (previous.roomThemeId) {
        roomThemes[conversationIdToClear] = {
          roomThemeId: previous.roomThemeId,
          customBackgroundImage: undefined,
        };
      } else {
        delete roomThemes[conversationIdToClear];
      }
      const next: RoomVisualSettingsState = { ...current, roomThemes };

      persistRoomVisualSettings(storageKey, next);
      if (previous.roomThemeId) {
        syncConversation(conversationIdToClear, next);
      } else {
        resetSyncedConversation(conversationIdToClear);
      }
      return next;
    });
  }, [resetSyncedConversation, storageKey, syncConversation]);

  return {
    settings,
    computed,
    activeRoomThemeId,
    activeConversationBackground,
    hasConversationOverride:
      conversationId ? Boolean(settings.roomThemes[conversationId]) : false,
    setDefaultRoomTheme,
    setRoomBubbleStyle,
    setConversationTheme,
    setConversationBackground,
    resetConversationTheme,
    clearConversationBackground,
  };
};
