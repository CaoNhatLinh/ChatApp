import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_BUBBLE_STYLE_ID,
  DEFAULT_ROOM_THEME_ID,
  getRoomVisualComputed,
  type ChatBubbleStyleId,
  ROOM_THEME_PRESETS,
  ROOM_THEME_STORAGE_KEY,
  type RoomThemeId,
  type RoomVisualSettingsState,
  type RoomVisualComputed,
} from '@/features/settings/constants/chat-theme.constants';

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

            const customBackgroundImage = typedValue?.customBackgroundImage?.trim()
              ? typedValue.customBackgroundImage.trim()
              : undefined;

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

const getPersistedRoomVisualSettings = (): RoomVisualSettingsState => {
  if (typeof window === 'undefined') return EMPTY_ROOM_VISUAL_SETTINGS;

  const rawSettings = localStorage.getItem(ROOM_THEME_STORAGE_KEY);
  return normalizeThemeState(rawSettings);
};

const persistRoomVisualSettings = (settings: RoomVisualSettingsState) => {
  if (typeof window === 'undefined') return;

  localStorage.setItem(ROOM_THEME_STORAGE_KEY, JSON.stringify(settings));
};

export const useRoomThemeState = (conversationId: string | null) => {
  const [settings, setSettings] = useState<RoomVisualSettingsState>(() =>
    getPersistedRoomVisualSettings(),
  );

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
    setSettings((current) => {
      const next: RoomVisualSettingsState = {
        ...current,
        defaultRoomThemeId: themeId,
      };

      persistRoomVisualSettings(next);
      return next;
    });
  }, []);

  const setRoomBubbleStyle = useCallback((bubbleStyle: ChatBubbleStyleId) => {
    setSettings((current) => {
      const next: RoomVisualSettingsState = {
        ...current,
        messageBubbleStyle: bubbleStyle,
      };

      persistRoomVisualSettings(next);
      return next;
    });
  }, []);

  const setConversationTheme = useCallback((conversationIdToSet: string, themeId: RoomThemeId) => {
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

      persistRoomVisualSettings(next);
      return next;
    });
  }, []);

  const setConversationBackground = useCallback((conversationIdToSet: string, backgroundUrl: string) => {
    setSettings((current) => {
      const next: RoomVisualSettingsState = {
        ...current,
        roomThemes: {
          ...current.roomThemes,
          [conversationIdToSet]: {
            ...current.roomThemes[conversationIdToSet],
            customBackgroundImage: backgroundUrl,
          },
        },
      };

      persistRoomVisualSettings(next);
      return next;
    });
  }, []);

  const resetConversationTheme = useCallback((conversationIdToReset: string) => {
    setSettings((current) => {
      const next: RoomVisualSettingsState = {
        ...current,
        roomThemes: {
          ...current.roomThemes,
          [conversationIdToReset]: {
            roomThemeId: undefined,
            customBackgroundImage: undefined,
          },
        },
      };

      persistRoomVisualSettings(next);
      return next;
    });
  }, []);

  const clearConversationBackground = useCallback((conversationIdToClear: string) => {
    setSettings((current) => {
      const previous = current.roomThemes[conversationIdToClear];
      if (!previous?.customBackgroundImage) return current;

      const next: RoomVisualSettingsState = {
        ...current,
        roomThemes: {
          ...current.roomThemes,
          [conversationIdToClear]: {
            roomThemeId: previous.roomThemeId,
            customBackgroundImage: undefined,
          },
        },
      };

      persistRoomVisualSettings(next);
      return next;
    });
  }, []);

  const clearRoomSettingsIfEmpty = useCallback((conversationIdToClean: string) => {
    setSettings((current) => {
      const override = current.roomThemes[conversationIdToClean];
      if (!override) return current;

      const { roomThemeId, customBackgroundImage } = override;
      if (!roomThemeId && !customBackgroundImage) {
        return current;
      }

      const next: RoomVisualSettingsState = {
        ...current,
        roomThemes: {
          ...current.roomThemes,
          [conversationIdToClean]: {
            roomThemeId: undefined,
            customBackgroundImage: undefined,
          },
        },
      };

      persistRoomVisualSettings(next);
      return next;
    });
  }, []);

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
    clearRoomSettingsIfEmpty,
  };
};
