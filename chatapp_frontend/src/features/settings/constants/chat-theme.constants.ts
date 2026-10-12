import { UI_COPY } from "@/shared/constants/ui-copy";

export type RoomThemeId = "aurora" | "neon" | "studio" | "vapor";
export type ChatBubbleStyleId = "tiktok" | "glass" | "classic";
export type RoomThemeMode = "light" | "dark";
export type CustomBackgroundTreatment = "soft" | "strong";

export interface RoomThemePreset {
  id: RoomThemeId;
  mode: RoomThemeMode;
  name: string;
  description: string;
  character: string;
  signalColor: string;
  signalForeground: string;
  overlay: string;
  backgroundImage?: string;
}

export interface ChatBubbleStylePreset {
  id: ChatBubbleStyleId;
  name: string;
  description: string;
  ownClass: string;
  peerClass: string;
  statusClass: string;
}

export const ROOM_THEME_PRESETS: RoomThemePreset[] = [
  {
    id: "aurora",
    mode: "dark",
    name: "Signal Dawn",
    description: "Lớp sáng cam nhẹ trên nền mực, giúp khu vực chat có nhịp rõ ràng.",
    character: "Ấm · cân bằng",
    signalColor: "oklch(0.68 0.18 42)",
    signalForeground: "oklch(0.15 0.02 255)",
    overlay: "radial-gradient(circle at 76% 4%, oklch(0.7 0.17 42 / 22%), transparent 34%), linear-gradient(180deg, oklch(0.2 0.03 255) 0%, oklch(0.12 0.024 255) 100%)",
    backgroundImage: undefined,
  },
  {
    id: "neon",
    mode: "dark",
    name: "Signal Grid",
    description: "Độ tương phản cao, giữ nhãn và tin nhắn dễ quét khi room đông.",
    character: "Sắc · mật độ cao",
    signalColor: "oklch(0.76 0.14 226)",
    signalForeground: "oklch(0.15 0.025 255)",
    overlay: "radial-gradient(circle at 88% 12%, oklch(0.76 0.14 226 / 28%), transparent 30%), linear-gradient(145deg, oklch(0.23 0.055 258), oklch(0.11 0.025 255) 56%, oklch(0.09 0.02 255) 100%)",
    backgroundImage: undefined,
  },
  {
    id: "studio",
    mode: "light",
    name: "Studio Matte",
    description: "Mặt nền phẳng và yên, ưu tiên đọc nội dung trong thời gian dài.",
    character: "Sáng · tĩnh",
    signalColor: "oklch(0.48 0.1 166)",
    signalForeground: "oklch(0.985 0.008 248)",
    overlay: "radial-gradient(circle at 84% 8%, oklch(0.78 0.08 158 / 34%), transparent 30%), linear-gradient(160deg, oklch(0.985 0.008 248) 0%, oklch(0.94 0.018 248) 72%, oklch(0.9 0.025 248) 100%)",
    backgroundImage: undefined,
  },
  {
    id: "vapor",
    mode: "dark",
    name: "Signal Haze",
    description: "Lớp tím khói hòa với ánh cyan, dịu nhưng vẫn có chiều sâu.",
    character: "Sâu · dịu",
    signalColor: "oklch(0.72 0.15 314)",
    signalForeground: "oklch(0.15 0.025 255)",
    overlay: "radial-gradient(circle at 12% 12%, oklch(0.72 0.15 314 / 24%), transparent 28%), radial-gradient(circle at 86% 70%, oklch(0.72 0.12 205 / 18%), transparent 34%), linear-gradient(160deg, oklch(0.21 0.04 278), oklch(0.11 0.023 255) 72%)",
    backgroundImage: undefined,
  },
];

export const CHAT_BUBBLE_PRESETS: ChatBubbleStylePreset[] = [
  {
    id: "tiktok",
    name: "Nhịp cắt",
    description: "Một nhịp cam sắc gọn, thời gian và trạng thái nằm sát mép tin.",
    ownClass:
      "chat-bubble-own chat-bubble-signal",
    peerClass:
      "chat-bubble-peer chat-bubble-signal-peer border border-border/60 bg-card/94 text-foreground",
    statusClass: "chat-bubble-status-signal",
  },
  {
    id: "glass",
    name: "Quỹ đạo mềm",
    description: "Bong bóng mềm và thoáng, hợp với cuộc trò chuyện ít nhưng dài.",
    ownClass:
      "chat-bubble-own chat-bubble-orbit text-foreground",
    peerClass:
      "chat-bubble-peer chat-bubble-orbit-peer bg-card/80 border border-border/55 text-foreground backdrop-blur-md",
    statusClass: "text-muted-foreground",
  },
  {
    id: "classic",
    name: "Ghi chú nối",
    description: "Cạnh thẳng, nhịp dọc rõ; đọc nhanh khi room có nhiều tin liên tiếp.",
    ownClass:
      "chat-bubble-own chat-bubble-note text-foreground",
    peerClass: "chat-bubble-peer chat-bubble-note-peer bg-card/86 border-l-2 border-muted-foreground/35 text-foreground",
    statusClass: "text-muted-foreground/90",
  },
];

export const ROOM_THEME_PRESETS_BY_ID = ROOM_THEME_PRESETS.reduce<Record<RoomThemeId, RoomThemePreset>>(
  (acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  },
  {} as Record<RoomThemeId, RoomThemePreset>,
);

export const CHAT_BUBBLE_PRESETS_BY_ID = CHAT_BUBBLE_PRESETS.reduce<Record<ChatBubbleStyleId, ChatBubbleStylePreset>>(
  (acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  },
  {} as Record<ChatBubbleStyleId, ChatBubbleStylePreset>,
);

export const DEFAULT_ROOM_THEME_ID: RoomThemeId = "aurora";
export const DEFAULT_BUBBLE_STYLE_ID: ChatBubbleStyleId = "tiktok";

export interface RoomVisualSettingsState {
  defaultRoomThemeId: RoomThemeId;
  messageBubbleStyle: ChatBubbleStyleId;
  roomThemes: Record<
    string,
    {
      roomThemeId?: RoomThemeId;
      customBackgroundImage?: string;
      customBackgroundTreatment?: CustomBackgroundTreatment;
    }
  >;
}

export interface RoomVisualComputed {
  preset: RoomThemePreset;
  backgroundImage?: string;
  backgroundOverlay: string;
  messageBubbleStyle: ChatBubbleStylePreset;
  signalColor: string;
  signalForeground: string;
}

export const ROOM_THEME_STORAGE_KEY = "novachat-room-visual-settings";
export const CUSTOM_BACKGROUND_OVERLAYS: Record<CustomBackgroundTreatment, string> = {
  soft: "linear-gradient(180deg, rgb(5 12 18 / 8%), rgb(5 12 18 / 38%))",
  strong: "linear-gradient(180deg, rgb(5 12 18 / 30%), rgb(5 12 18 / 76%))",
};

export const normalizeRoomBackgroundUrl = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined || value.trim() === '') return null;
  const normalized = value.trim();
  const parsed = new URL(normalized);
  if (!parsed.hostname || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    throw new Error('customBackgroundUrl must be an absolute http(s) URL');
  }
  return normalized;
};

export const getRoomVisualComputed = (
  state: RoomVisualSettingsState,
  conversationId: string | null,
): RoomVisualComputed => {
  const activeOverride = conversationId ? state.roomThemes[conversationId] : undefined;
  const presetId = conversationId && activeOverride?.roomThemeId
    ? activeOverride.roomThemeId
    : state.defaultRoomThemeId;
  const preset = ROOM_THEME_PRESETS_BY_ID[presetId];
  const bubbleStyle = CHAT_BUBBLE_PRESETS_BY_ID[state.messageBubbleStyle];
  const customBackgroundImage = activeOverride?.customBackgroundImage;

  return {
    preset,
    backgroundImage: customBackgroundImage || preset.backgroundImage,
    backgroundOverlay: activeOverride?.customBackgroundTreatment
      ? CUSTOM_BACKGROUND_OVERLAYS[activeOverride.customBackgroundTreatment]
      : preset.overlay,
    messageBubbleStyle: bubbleStyle,
    signalColor: preset.signalColor,
    signalForeground: preset.signalForeground,
  };
};

import { localizedCopy } from '@/shared/i18n';

const rawChatThemeCopy = {
  panelTitle: "Giao diện của bạn",
  panelDescription: "Tùy chỉnh này chỉ hiển thị với bạn.",
  resetConversation: "Dùng mặc định",
  activeRoomHint: (conversationName: string) => `Áp dụng riêng cho: ${conversationName}`,
  noActiveConversation: "Chọn cuộc trò chuyện để tùy chỉnh giao diện.",
  defaultThemeLabel: "Mặc định cho cuộc trò chuyện mới",
  defaultBubbleLabel: "Kiểu bong bóng của bạn",
  roomThemeLabel: "Chủ đề cuộc trò chuyện",
  roomBackgroundLabel: "Hình nền riêng",
  roomBackgroundPlaceholder: "Dán URL ảnh hoặc tải ảnh từ thiết bị",
  roomBackgroundUpload: "Tải ảnh lên",
  roomBackgroundUploading: "Đang tải ảnh lên…",
  roomBackgroundCustomLabel: "Tùy chỉnh",
  roomBackgroundCustomHint: "Ảnh sẽ được phủ lớp gradient tự động để chữ luôn dễ đọc.",
  showMessage: "Chủ đề đang dùng",
} as const;

export const CHAT_THEME_COPY = localizedCopy(rawChatThemeCopy);

const rawChatThemeStatus = {
  loading: UI_COPY.status.loading,
  noConversationSelected: "Chưa chọn cuộc trò chuyện",
  conversationSaved: "Đã lưu giao diện riêng cho cuộc trò chuyện này",
  defaultsUpdated: "Đã cập nhật giao diện mặc định của bạn",
} as const;

export const CHAT_THEME_STATUS = localizedCopy(rawChatThemeStatus);
