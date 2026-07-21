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
    name: "Aurora Pulse",
    description: "Gradient xanh tim nhieu tang, ton sang trong cho khong gian chat.",
    accent: "bg-indigo-500/25",
    overlay: "linear-gradient(135deg, rgba(79,70,229,0.4), rgba(56,189,248,0.28), rgba(14,165,233,0.2))",
    backgroundImage:
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1800&q=80",
  },
  {
    id: "neon",
    name: "Neon City",
    description: "Phong cach cong nghe tuoi sang, no de nhan biet nhanh trong convo.",
    accent: "bg-fuchsia-500/25",
    overlay: "linear-gradient(145deg, rgba(192,38,211,0.35), rgba(14,165,233,0.24), rgba(16,185,129,0.18))",
    backgroundImage:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1800&q=80",
  },
  {
    id: "studio",
    name: "Studio Matte",
    description: "Nen toi sach, toi uu cho noi dung va cam giac thong suot.",
    accent: "bg-slate-500/25",
    overlay: "linear-gradient(160deg, rgba(15,23,42,0.68), rgba(30,41,59,0.3), rgba(71,85,105,0.24))",
    backgroundImage: undefined,
  },
  {
    id: "vapor",
    name: "Vapor Frame",
    description: "Mau sac mo hieu ung, giup room tro choi co cam giac metaverse.",
    accent: "bg-cyan-500/20",
    overlay: "linear-gradient(160deg, rgba(6,182,212,0.25), rgba(59,130,246,0.22), rgba(217,70,239,0.2))",
    backgroundImage:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1800&q=80",
  },
];

export const CHAT_BUBBLE_PRESETS: ChatBubbleStylePreset[] = [
  {
    id: "tiktok",
    name: "TikTok Style",
    description: "Bubble nang va reu, hover co hieu ung bo cong cu.",
    ownClass:
      "bg-gradient-to-r from-primary/95 to-primary/85 text-primary-foreground rounded-[1.1rem] rounded-br-md shadow-[0_8px_24px_-14px_rgba(0,0,0,0.35)] border border-primary/20",
    peerClass:
      "border border-border/55 bg-background/85 text-foreground/95 backdrop-blur-sm rounded-[1.1rem] rounded-bl-md shadow-[0_8px_24px_-18px_rgba(0,0,0,0.32)]",
    statusClass: "text-primary/90",
  },
  {
    id: "glass",
    name: "Glass Soft",
    description: "Hieu ung nang, phu hop nen nang va de doc.",
    ownClass:
      "bg-primary/15 text-primary-foreground border border-primary/20 rounded-[1.6rem] shadow-[0_10px_30px_-20px_rgba(37,99,235,0.45)]",
    peerClass:
      "bg-card/85 border border-border/60 backdrop-blur-sm rounded-[1.6rem] text-foreground/95",
    statusClass: "text-muted-foreground",
  },
  {
    id: "classic",
    name: "Classic Focus",
    description: "Dong dan, gap mat, giu nhan tri nhat cho lich su chat.",
    ownClass:
      "bg-primary text-primary-foreground rounded-[1.3rem] shadow-lg border border-primary/20",
    peerClass: "bg-card border border-border/60 rounded-[1.3rem] text-foreground/95",
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

export const CHAT_THEME_COPY = {
  panelTitle: "Room Visual",
  panelDescription: "Thiet lap kich ban phong chat hien tai.",
  resetConversation: "Dat mac dinh",
  activeRoomHint: (conversationName: string) => `Dang bo sung cho: ${conversationName}`,
  noActiveConversation: "Mo phong chat de cai dat background",
  defaultThemeLabel: "Theme mac dinh",
  defaultBubbleLabel: "Kieu bubble",
  roomThemeLabel: "Theme cho phong",
  roomBackgroundLabel: "Nap background",
  roomBackgroundPlaceholder: "Paste URL anh hoac de trong de dung mac dinh",
  roomBackgroundApply: "Ap dung",
  roomBackgroundClear: "Xoa hinh nen",
  showMessage: "Xem truoc",
} as const;

export const CHAT_THEME_STATUS = {
  loading: UI_COPY.status.loading,
  noConversationSelected: "Chua chon cuoc tro chuyen",
  conversationSaved: "Da luu cai dat cho phong nay",
  defaultsUpdated: "Da cap nhat cai dat mac dinh",
} as const;
