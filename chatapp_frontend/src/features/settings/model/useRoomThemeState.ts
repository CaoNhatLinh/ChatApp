import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_BUBBLE_STYLE_ID,
  DEFAULT_ROOM_THEME_ID,
  type CustomBackgroundTreatment,
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
import { useTheme } from '@/app/providers/theme';

const EMPTY_ROOM_VISUAL_SETTINGS: RoomVisualSettingsState = {
  defaultRoomThemeId: DEFAULT_ROOM_THEME_ID,
  messageBubbleStyle: DEFAULT_BUBBLE_STYLE_ID,
  roomThemes: {},
};

export interface AppearanceDraft {
  themeId: RoomThemeId;
  bubbleStyleId: ChatBubbleStyleId;
  backgroundUrl: string | null;
  backgroundAssetId?: string;
  backgroundTreatment: CustomBackgroundTreatment;
  resetRoom: boolean;
}

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
              backgroundAssetId?: string;
              customBackgroundImage?: string;
              customBackgroundTreatment?: string;
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
              backgroundAssetId: customBackgroundImage && typeof typedValue.backgroundAssetId === 'string'
                ? typedValue.backgroundAssetId || undefined
                : undefined,
              customBackgroundImage,
              customBackgroundTreatment:
                typedValue?.customBackgroundTreatment === 'soft' || typedValue?.customBackgroundTreatment === 'strong'
                  ? typedValue.customBackgroundTreatment
                  : undefined,
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
  const { isDarkMode } = useTheme();
  const storageKey = useMemo(() => getRoomVisualStorageKey(userId), [userId]);
  const hasUserInteractedRef = useRef(false);
  const [settings, setSettings] = useState<RoomVisualSettingsState>(() =>
    getPersistedRoomVisualSettings(userId),
  );
  const settingsRef = useRef(settings);
  const userScopeRef = useRef(userId);
  userScopeRef.current = userId;

  useEffect(() => {
    hasUserInteractedRef.current = false;
    const localSettings = getPersistedRoomVisualSettings(userId);
    settingsRef.current = localSettings;
    setSettings(localSettings);
    if (!userId) return;

    let active = true;
    void getChatAppearancePreferences()
      .then((remote) => {
        if (!active || hasUserInteractedRef.current) return;
        const remoteRoomThemes = remote.rooms.reduce<RoomVisualSettingsState['roomThemes']>((acc, room) => {
          const customBackgroundImage = room.customBackgroundUrl?.trim() || undefined;
          const localTreatment = getPersistedRoomVisualSettings(userId).roomThemes[room.conversationId]?.customBackgroundTreatment;
          acc[room.conversationId] = {
            roomThemeId: room.themeId,
            backgroundAssetId: customBackgroundImage ? room.backgroundAssetId ?? undefined : undefined,
            customBackgroundImage,
            customBackgroundTreatment: localTreatment,
          };
          return acc;
        }, {});
        const next: RoomVisualSettingsState = {
          defaultRoomThemeId: remote.defaultThemeId,
          messageBubbleStyle: remote.defaultBubbleStyleId,
          roomThemes: remoteRoomThemes,
        };
        persistRoomVisualSettings(getRoomVisualStorageKey(userId), next);
        settingsRef.current = next;
        setSettings(next);
      })
      .catch((error: unknown) => {
        logger.warn('[RoomTheme] Failed to load server preferences', error instanceof Error ? error.message : String(error));
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const computed = useMemo<RoomVisualComputed>(
    () => getRoomVisualComputed(settings, conversationId, isDarkMode),
    [conversationId, settings, isDarkMode],
  );

  const activeRoomThemeId =
    conversationId && settings.roomThemes[conversationId]?.roomThemeId
      ? settings.roomThemes[conversationId].roomThemeId
      : settings.defaultRoomThemeId;

  const activeConversationBackground = conversationId
    ? settings.roomThemes[conversationId]?.customBackgroundImage
    : undefined;

  const activeConversationBackgroundTreatment = conversationId
    ? settings.roomThemes[conversationId]?.customBackgroundTreatment
    : undefined;

  const commitSettings = useCallback((next: RoomVisualSettingsState) => {
    settingsRef.current = next;
    setSettings(next);
    persistRoomVisualSettings(storageKey, next);
  }, [storageKey]);

  const saveAppearance = useCallback(async (draft: AppearanceDraft) => {
    if (!userId) throw new Error('Authentication required');
    hasUserInteractedRef.current = true;
    const current = settingsRef.current;
    const next = { ...current, roomThemes: { ...current.roomThemes } };
    // Complete each canonical write before updating its local representation.
    if (!conversationId || draft.bubbleStyleId !== current.messageBubbleStyle) {
      await saveChatAppearancePreferences(conversationId ? current.defaultRoomThemeId : draft.themeId, draft.bubbleStyleId);
      if (userScopeRef.current !== userId) throw new Error('Session changed');
      next.defaultRoomThemeId = conversationId ? current.defaultRoomThemeId : draft.themeId;
      next.messageBubbleStyle = draft.bubbleStyleId;
      commitSettings(next);
    }
    if (conversationId) {
      if (draft.resetRoom) {
        await resetConversationAppearancePreference(conversationId);
        if (userScopeRef.current !== userId) throw new Error('Session changed');
        delete next.roomThemes[conversationId];
      } else {
        const backgroundUrl = normalizeRoomBackgroundUrl(draft.backgroundUrl);
        const previousRoom = current.roomThemes[conversationId];
        const previousAssetId = backgroundUrl === previousRoom?.customBackgroundImage
          ? previousRoom.backgroundAssetId
          : undefined;
        const backgroundAssetId = backgroundUrl
          ? draft.backgroundAssetId ?? previousAssetId ?? null
          : null;
        await saveConversationAppearancePreference(conversationId, draft.themeId, backgroundUrl, backgroundAssetId);
        if (userScopeRef.current !== userId) throw new Error('Session changed');
        next.roomThemes[conversationId] = { roomThemeId: draft.themeId, backgroundAssetId: backgroundAssetId ?? undefined,
          customBackgroundImage: backgroundUrl ?? undefined, customBackgroundTreatment: draft.backgroundTreatment };
      }
      commitSettings(next);
    }
  }, [commitSettings, conversationId, userId]);

  return {
    settings,
    computed,
    activeRoomThemeId,
    activeConversationBackground,
    activeConversationBackgroundTreatment,
    hasConversationOverride:
      conversationId ? Boolean(settings.roomThemes[conversationId]) : false,
    saveAppearance,
  };
};
