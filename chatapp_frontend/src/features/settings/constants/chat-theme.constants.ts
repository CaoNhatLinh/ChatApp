import { UI_COPY } from "@/shared/constants/ui-copy";

export type RoomThemeId = "aurora" | "neon" | "studio" | "vapor";
export type ChatBubbleStyleId = "tiktok" | "glass" | "classic";

export interface RoomThemePreset {
  id: RoomThemeId;
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
    name: "Signal Dawn",
    description: "Lớp sáng cam nhẹ trên nền mực, giúp khu vực chat có nhịp rõ ràng.",
    accent: "bg-primary/20",
    overlay: "linear-gradient(135deg, color-mix(in oklab, var(--primary) 28%, transparent), transparent 68%)",
    backgroundImage: undefined,
  },
  {
    id: "neon",
    name: "Signal Grid",
    description: "Độ tương phản cao, giữ nhãn và tin nhắn dễ quét khi room đông.",
    accent: "bg-primary/15",
    overlay: "linear-gradient(145deg, color-mix(in oklab, var(--primary) 20%, transparent), color-mix(in oklab, var(--foreground) 8%, transparent))",
    backgroundImage: undefined,
  },
  {
    id: "studio",
    name: "Studio Matte",
    description: "Mặt nền phẳng và yên, ưu tiên đọc nội dung trong thời gian dài.",
    accent: "bg-muted",
    overlay: "linear-gradient(160deg, color-mix(in oklab, var(--foreground) 12%, transparent), transparent 72%)",
    backgroundImage: undefined,
  },
  {
    id: "vapor",
    name: "Signal Haze",
    description: "Một lớp mờ có chiều sâu nhưng vẫn giữ màu cam làm điểm neo.",
    accent: "bg-primary/10",
    overlay: "linear-gradient(160deg, color-mix(in oklab, var(--primary) 16%, transparent), color-mix(in oklab, var(--background) 14%, transparent))",
    backgroundImage: undefined,
  },
];

export const CHAT_BUBBLE_PRESETS: ChatBubbleStylePreset[] = [
  {
    id: "tiktok",
    name: "TikTok Style",
    description: "Tin của bạn có điểm nhấn vừa đủ, không làm mất nhịp đọc.",
    ownClass:
      "bg-primary text-primary-foreground rounded-[var(--radius-md)] rounded-br-sm shadow-sm border border-primary/20",
    peerClass:
      "border border-border bg-background text-foreground rounded-[var(--radius-md)] rounded-bl-sm",
    statusClass: "text-primary/90",
  },
  {
    id: "glass",
    name: "Glass Soft",
    description: "Bề mặt nhẹ, phù hợp khi muốn giữ nhiều khoảng thở trong room.",
    ownClass:
      "bg-primary/15 text-foreground border border-primary/25 rounded-[var(--radius-lg)] rounded-br-sm",
    peerClass:
      "bg-card border border-border rounded-[var(--radius-lg)] rounded-bl-sm text-foreground",
    statusClass: "text-muted-foreground",
  },
  {
    id: "classic",
    name: "Classic Focus",
    description: "Gọn và chắc, dành cho lịch sử tin nhắn cần quét nhanh.",
    ownClass:
      "bg-primary text-primary-foreground rounded-[var(--radius-md)] rounded-br-sm border border-primary/20",
    peerClass: "bg-card border border-border rounded-[var(--radius-md)] rounded-bl-sm text-foreground",
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
    }
  >;
}

export interface RoomVisualComputed {
  preset: RoomThemePreset;
  backgroundImage?: string;
  messageBubbleStyle: ChatBubbleStylePreset;
}

export const ROOM_THEME_STORAGE_KEY = "novachat-room-visual-settings";

export const normalizeRoomBackgroundUrl = (value: string | null | undefined): string | null => {
  if (value == null || value.trim() === '') return null;
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
    messageBubbleStyle: bubbleStyle,
  };
};

import { localizedCopy } from '@/shared/i18n';

const rawChatThemeCopy = {
  panelTitle: "Giao diện phòng chat",
  panelDescription: "Thiết lập giao diện phòng chat hiện tại.",
  resetConversation: "Đặt mặc định",
  activeRoomHint: (conversationName: string) => `Đang áp dụng cho: ${conversationName}`,
  noActiveConversation: "Mở phòng chat để cài đặt hình nền",
  defaultThemeLabel: "Chủ đề mặc định",
  defaultBubbleLabel: "Kiểu bong bóng",
  roomThemeLabel: "Chủ đề cho phòng",
  roomBackgroundLabel: "Tải hình nền",
  roomBackgroundPlaceholder: "Dán URL ảnh hoặc để trống để dùng mặc định",
  roomBackgroundApply: "Áp dụng",
  roomBackgroundClear: "Xóa hình nền",
  showMessage: "Xem trước",
} as const;

export const CHAT_THEME_COPY = localizedCopy(rawChatThemeCopy);

const rawChatThemeStatus = {
  loading: UI_COPY.status.loading,
  noConversationSelected: "Chưa chọn cuộc trò chuyện",
  conversationSaved: "Đã lưu cài đặt cho phòng này",
  defaultsUpdated: "Đã cập nhật cài đặt mặc định",
} as const;

export const CHAT_THEME_STATUS = localizedCopy(rawChatThemeStatus);
