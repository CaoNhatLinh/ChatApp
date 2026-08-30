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
  accent: string;
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
    accent: "bg-primary/20",
    overlay: "radial-gradient(circle at 76% 4%, rgb(244 92 32 / 18%), transparent 32%), linear-gradient(180deg, #0d1720 0%, #071018 100%)",
    backgroundImage: undefined,
  },
  {
    id: "neon",
    mode: "dark",
    name: "Signal Grid",
    description: "Độ tương phản cao, giữ nhãn và tin nhắn dễ quét khi room đông.",
    accent: "bg-primary/15",
    overlay: "linear-gradient(145deg, rgb(244 92 32 / 14%), rgb(6 14 21 / 96%) 48%, #061019 100%)",
    backgroundImage: undefined,
  },
  {
    id: "studio",
    mode: "light",
    name: "Studio Matte",
    description: "Mặt nền phẳng và yên, ưu tiên đọc nội dung trong thời gian dài.",
    accent: "bg-muted",
    overlay: "linear-gradient(160deg, #f7f9fc 0%, #e8eef3 72%, #dfe8ee 100%)",
    backgroundImage: undefined,
  },
  {
    id: "vapor",
    mode: "dark",
    name: "Signal Haze",
    description: "Một lớp mờ có chiều sâu nhưng vẫn giữ màu cam làm điểm neo.",
    accent: "bg-primary/10",
    overlay: "radial-gradient(circle at 12% 12%, rgb(244 92 32 / 12%), transparent 28%), linear-gradient(160deg, #111b24, #071018 72%)",
    backgroundImage: undefined,
  },
];

export const CHAT_BUBBLE_PRESETS: ChatBubbleStylePreset[] = [
  {
    id: "tiktok",
    name: "TikTok Style",
    description: "Tin của bạn có điểm nhấn vừa đủ, không làm mất nhịp đọc.",
    ownClass:
      "bg-primary text-primary-foreground rounded-[1.25rem] rounded-br-md shadow-[0_10px_24px_hsl(var(--primary)/.22)] border border-primary/30",
    peerClass:
      "border border-border/80 bg-card/90 text-foreground rounded-[1.25rem] rounded-bl-md",
    statusClass: "text-primary/90",
  },
  {
    id: "glass",
    name: "Glass Soft",
    description: "Bề mặt nhẹ, phù hợp khi muốn giữ nhiều khoảng thở trong room.",
    ownClass:
      "bg-primary/20 text-foreground border border-primary/35 backdrop-blur-md rounded-[1.5rem] rounded-br-md shadow-[0_8px_26px_hsl(var(--primary)/.1)]",
    peerClass:
      "bg-card/65 backdrop-blur-md border border-border/70 rounded-[1.5rem] rounded-bl-md text-foreground",
    statusClass: "text-muted-foreground",
  },
  {
    id: "classic",
    name: "Classic Focus",
    description: "Gọn và chắc, dành cho lịch sử tin nhắn cần quét nhanh.",
    ownClass:
      "bg-primary text-primary-foreground rounded-2xl rounded-tr-md border border-primary/30 shadow-sm",
    peerClass: "bg-card border border-border/80 rounded-2xl rounded-tl-md text-foreground",
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
