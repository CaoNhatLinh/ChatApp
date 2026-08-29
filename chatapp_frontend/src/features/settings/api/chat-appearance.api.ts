import apiClient from '@/shared/api/apiClient';
import {
  normalizeRoomBackgroundUrl,
  type ChatBubbleStyleId,
  type RoomThemeId,
} from '@/features/settings/constants/chat-theme.constants';

export interface ChatAppearancePreferences {
  defaultThemeId: RoomThemeId;
  defaultBubbleStyleId: ChatBubbleStyleId;
  rooms: ConversationAppearancePreference[];
}

export interface ConversationAppearancePreference {
  conversationId: string;
  themeId: RoomThemeId;
  customBackgroundUrl?: string | null;
  updatedAt: string;
}

interface ChatAppearancePreferencesResponse {
  defaultThemeId: string;
  defaultBubbleStyleId: string;
  rooms: ConversationAppearancePreference[];
}

const isRoomThemeId = (value: string): value is RoomThemeId => (
  value === 'aurora' || value === 'neon' || value === 'studio' || value === 'vapor'
);

const isBubbleStyleId = (value: string): value is ChatBubbleStyleId => (
  value === 'tiktok' || value === 'glass' || value === 'classic'
);

const toPreferences = (response: ChatAppearancePreferencesResponse): ChatAppearancePreferences => {
  if (!isRoomThemeId(response.defaultThemeId)) {
    throw new Error(`Unsupported default chat theme from server: ${response.defaultThemeId}`);
  }
  if (!isBubbleStyleId(response.defaultBubbleStyleId)) {
    throw new Error(`Unsupported default bubble style from server: ${response.defaultBubbleStyleId}`);
  }
  const rooms = response.rooms.map((room) => {
    if (!isRoomThemeId(room.themeId)) {
      throw new Error(`Unsupported room chat theme from server: ${room.themeId}`);
    }
    return room;
  });
  return {
    defaultThemeId: response.defaultThemeId,
    defaultBubbleStyleId: response.defaultBubbleStyleId,
    rooms,
  };
};

export const getChatAppearancePreferences = async (): Promise<ChatAppearancePreferences> => {
  const response = await apiClient.get<ChatAppearancePreferencesResponse>('/preferences/chat');
  return toPreferences(response.data);
};

export const saveChatAppearancePreferences = async (
  defaultThemeId: RoomThemeId,
  defaultBubbleStyleId: ChatBubbleStyleId,
): Promise<void> => {
  await apiClient.put('/preferences/chat', { defaultThemeId, defaultBubbleStyleId });
};

export const saveConversationAppearancePreference = async (
  conversationId: string,
  themeId: RoomThemeId,
  customBackgroundUrl: string | null,
): Promise<void> => {
  await apiClient.put(`/preferences/chat/rooms/${conversationId}`, {
    themeId,
    customBackgroundUrl: normalizeRoomBackgroundUrl(customBackgroundUrl),
  });
};

export const resetConversationAppearancePreference = async (conversationId: string): Promise<void> => {
  await apiClient.delete(`/preferences/chat/rooms/${conversationId}`);
};
