import { Check, Palette, RotateCcw, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { SurfacePanel } from '@/shared/ui/SurfacePanel';
import { localizeText } from '@/shared/i18n';
import { notifyError, notifySuccess } from '@/shared/lib/notification';
import {
  CHAT_BUBBLE_PRESETS,
  CHAT_THEME_COPY,
  CHAT_THEME_STATUS,
  CUSTOM_BACKGROUND_OVERLAYS,
  normalizeRoomBackgroundUrl,
  ROOM_THEME_PRESETS,
} from '@/features/settings/constants/chat-theme.constants';
import { uploadChatBackground } from '@/features/settings/api/chat-appearance.api';
import type {
  ChatBubbleStyleId,
  CustomBackgroundTreatment,
  RoomThemeId,
  RoomThemeMode,
} from '@/features/settings/constants/chat-theme.constants';

interface RoomThemePanelProps {
  conversationId: string | null;
  conversationName: string;
  defaultRoomThemeId: RoomThemeId;
  defaultBubbleStyleId: ChatBubbleStyleId;
  activeRoomThemeId: RoomThemeId;
  activeBackgroundImage: string;
  activeBackgroundTreatment?: CustomBackgroundTreatment;
  hasConversationOverride: boolean;
  onSetDefaultRoomTheme: (themeId: RoomThemeId) => void;
  onSetRoomTheme: (themeId: RoomThemeId) => void;
  onSetBubbleStyle: (bubbleStyleId: ChatBubbleStyleId) => void;
  onSetBackgroundImage: (imageUrl: string, treatment?: CustomBackgroundTreatment) => void;
  onClearConversationTheme: () => void;
  onClearConversationBackground: () => void;
  onSaved?: () => void;
}

const getThemePreviewClassName = (themeId: RoomThemeId) => {
  if (themeId === 'studio') return 'bg-gradient-to-br from-[#f7f9fc] via-[#e8eef3] to-[#dfe8ee]';
  if (themeId === 'neon') return 'bg-gradient-to-br from-[#192938] via-[#0b1722] to-[#f45c20]';
  if (themeId === 'vapor') return 'bg-gradient-to-br from-[#1b2731] via-[#101b26] to-[#304354]';
  return 'bg-gradient-to-br from-[#263d45] via-[#111e28] to-[#f45c20]';
};

const analyzeImageTreatment = (file: File): Promise<CustomBackgroundTreatment> => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const width = Math.min(image.naturalWidth, 64);
      const height = Math.min(image.naturalHeight, 64);
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is not available');
      context.drawImage(image, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      let luminance = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        luminance += (0.2126 * pixels[index]) + (0.7152 * pixels[index + 1]) + (0.0722 * pixels[index + 2]);
      }
      const averageLuminance = luminance / Math.max(1, pixels.length / 4) / 255;
      resolve(averageLuminance > 0.56 ? 'strong' : 'soft');
    } catch (error) {
      reject(error instanceof Error ? error : new Error('The selected image could not be analyzed'));
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('The selected image could not be read'));
  };
  image.src = objectUrl;
});

export const RoomThemePanel = ({
  conversationId,
  conversationName,
  defaultRoomThemeId,
  defaultBubbleStyleId,
  activeRoomThemeId,
  activeBackgroundImage,
  activeBackgroundTreatment,
  hasConversationOverride,
  onSetDefaultRoomTheme,
  onSetRoomTheme,
  onSetBubbleStyle,
  onSetBackgroundImage,
  onClearConversationTheme,
  onClearConversationBackground,
  onSaved,
}: RoomThemePanelProps) => {
  const hasActiveConversation = Boolean(conversationId);
  const [draftThemeId, setDraftThemeId] = useState<RoomThemeId>(activeRoomThemeId);
  const [draftBubbleStyleId, setDraftBubbleStyleId] = useState<ChatBubbleStyleId>(defaultBubbleStyleId);
  const [draftBackgroundUrl, setDraftBackgroundUrl] = useState(activeBackgroundImage);
  const [draftBackgroundTreatment, setDraftBackgroundTreatment] = useState<CustomBackgroundTreatment>(activeBackgroundTreatment ?? 'strong');
  const [themeMode, setThemeMode] = useState<RoomThemeMode | 'custom'>(
    activeBackgroundImage
      ? 'custom'
      : ROOM_THEME_PRESETS.find((theme) => theme.id === activeRoomThemeId)?.mode ?? 'dark',
  );
  const [pendingBackgroundFile, setPendingBackgroundFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [resetConversationDraft, setResetConversationDraft] = useState(false);

  useEffect(() => {
    setDraftThemeId(activeRoomThemeId);
    setDraftBubbleStyleId(defaultBubbleStyleId);
    setDraftBackgroundUrl(activeBackgroundImage);
    setDraftBackgroundTreatment(activeBackgroundTreatment ?? 'strong');
    setThemeMode(
      activeBackgroundImage
        ? 'custom'
        : ROOM_THEME_PRESETS.find((theme) => theme.id === activeRoomThemeId)?.mode ?? 'dark',
    );
    setPendingBackgroundFile(null);
    setPendingPreviewUrl(null);
    setResetConversationDraft(false);
  }, [activeBackgroundImage, activeBackgroundTreatment, activeRoomThemeId, defaultBubbleStyleId]);

  useEffect(() => () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
  }, [pendingPreviewUrl]);

  const isDirty = useMemo(
    () =>
      draftThemeId !== activeRoomThemeId ||
      themeMode !== (activeBackgroundImage
        ? 'custom'
        : ROOM_THEME_PRESETS.find((theme) => theme.id === activeRoomThemeId)?.mode ?? 'dark') ||
      draftBubbleStyleId !== defaultBubbleStyleId ||
      draftBackgroundUrl.trim() !== activeBackgroundImage.trim() ||
      Boolean(pendingBackgroundFile) ||
      draftBackgroundTreatment !== (activeBackgroundTreatment ?? 'strong') ||
      resetConversationDraft,
    [
      activeBackgroundImage,
      activeRoomThemeId,
      defaultBubbleStyleId,
      draftBackgroundUrl,
      draftBackgroundTreatment,
      draftBubbleStyleId,
      draftThemeId,
      themeMode,
      pendingBackgroundFile,
      resetConversationDraft,
      activeBackgroundTreatment,
    ],
  );

  const handleSave = async () => {
    let normalizedBackground: string | null;
    try {
      normalizedBackground = normalizeRoomBackgroundUrl(draftBackgroundUrl);
    } catch {
      notifyError(localizeText('Hình nền phải là URL http(s) hợp lệ.'));
      return;
    }

    setIsUploadingImage(Boolean(pendingBackgroundFile));
    if (pendingBackgroundFile) {
      try {
        normalizedBackground = await uploadChatBackground(pendingBackgroundFile);
      } catch {
        notifyError(localizeText('Không thể tải ảnh nền lên. Vui lòng thử lại.'));
        setIsUploadingImage(false);
        return;
      }
    }

    if (themeMode === 'custom' && !normalizedBackground && !resetConversationDraft) {
      notifyError(localizeText('Tùy chỉnh cần có ảnh nền.'));
      setIsUploadingImage(false);
      return;
    }

    if (hasActiveConversation) {
      if (resetConversationDraft) {
        onClearConversationTheme();
      } else {
        onSetRoomTheme(draftThemeId);
        if (normalizedBackground) {
          onSetBackgroundImage(normalizedBackground, draftBackgroundTreatment);
        } else if (activeBackgroundImage) {
          onClearConversationBackground();
        }
      }
    } else {
      onSetDefaultRoomTheme(draftThemeId);
    }
    onSetBubbleStyle(draftBubbleStyleId);
    notifySuccess(hasActiveConversation ? CHAT_THEME_STATUS.conversationSaved : CHAT_THEME_STATUS.defaultsUpdated);
    setIsUploadingImage(false);
    onSaved?.();
  };

  const handleResetDraft = () => {
    setDraftThemeId(defaultRoomThemeId);
    setThemeMode(ROOM_THEME_PRESETS.find((theme) => theme.id === defaultRoomThemeId)?.mode ?? 'dark');
    setDraftBackgroundUrl('');
    setDraftBackgroundTreatment('strong');
    setPendingBackgroundFile(null);
    setPendingPreviewUrl(null);
    setResetConversationDraft(true);
  };

  const handleBackgroundFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notifyError(localizeText('Chỉ chấp nhận tệp hình ảnh.'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      notifyError(localizeText('Ảnh nền không được vượt quá 10MB.'));
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPendingBackgroundFile(file);
    setPendingPreviewUrl(previewUrl);
    setDraftBackgroundUrl('');
    setThemeMode('custom');
    setResetConversationDraft(false);
    setIsAnalyzingImage(true);
    try {
      setDraftBackgroundTreatment(await analyzeImageTreatment(file));
    } catch {
      setDraftBackgroundTreatment('strong');
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const customPreviewUrl = pendingPreviewUrl || draftBackgroundUrl || null;
  const themeOptions = ROOM_THEME_PRESETS.filter((theme) => theme.mode === themeMode);

  return (
    <SurfacePanel className="mx-4 rounded-xl border-border/40 bg-card/90 px-3 py-3 sm:px-5 sm:py-4">
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-border/50 pb-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.14em] text-foreground">
            {CHAT_THEME_COPY.panelTitle}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {CHAT_THEME_COPY.panelDescription}{' '}
            {hasActiveConversation
              ? CHAT_THEME_COPY.activeRoomHint(conversationName)
              : CHAT_THEME_COPY.noActiveConversation}
          </p>
        </div>
        {isDirty ? (
          <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
            {localizeText('Có thay đổi chưa lưu')}
          </span>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <section className="space-y-2" aria-labelledby="room-theme-options">
          <label id="room-theme-options" className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
            {hasActiveConversation ? CHAT_THEME_COPY.roomThemeLabel : CHAT_THEME_COPY.defaultThemeLabel}
          </label>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-background/70 p-1">
            {(['light', 'dark', 'custom'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={themeMode === mode}
                onClick={() => {
                  setThemeMode(mode);
                  if (mode !== 'custom') {
                    const firstTheme = ROOM_THEME_PRESETS.find((theme) => theme.mode === mode);
                    if (firstTheme && ROOM_THEME_PRESETS.find((theme) => theme.id === draftThemeId)?.mode !== mode) {
                      setDraftThemeId(firstTheme.id);
                    }
                    setDraftBackgroundUrl('');
                    setDraftBackgroundTreatment('strong');
                    setPendingBackgroundFile(null);
                    setPendingPreviewUrl(null);
                    setResetConversationDraft(false);
                  }
                }}
                className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${themeMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
              >
                {mode === 'light' ? localizeText('Sáng') : mode === 'dark' ? localizeText('Tối') : localizeText('Tùy chỉnh')}
              </button>
            ))}
          </div>
          {themeMode === 'custom' ? (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
              {localizeText('Dùng ảnh nền riêng cho cuộc trò chuyện này. Ảnh sẽ được tự động cân bằng độ sáng để chữ luôn dễ đọc.')}
            </div>
          ) : null}
          <div className="grid gap-2">
            {themeOptions.map((theme) => {
              const active = draftThemeId === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setDraftThemeId(theme.id);
                    setResetConversationDraft(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-[border-color,background-color,transform] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${active ? 'border-primary bg-primary/10' : 'border-border/45 hover:bg-background/50'}`}
                >
                  <span className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 ${getThemePreviewClassName(theme.id)}`} aria-hidden="true">
                    <span className="absolute bottom-1 left-1 h-1.5 w-7 rounded-full bg-white/45" />
                    <span className="absolute bottom-1 right-1 h-2.5 w-5 rounded-full bg-primary" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black">{localizeText(theme.name)}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{localizeText(theme.description)}</span>
                  </span>
                  {active ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" /> : null}
                </button>
              );
            })}
          </div>
          {hasActiveConversation && hasConversationOverride ? (
            <p className="text-[11px] text-muted-foreground/85">
              {CHAT_THEME_COPY.showMessage}: {localizeText(ROOM_THEME_PRESETS.find((theme) => theme.id === activeRoomThemeId)?.name ?? '')}
            </p>
          ) : null}
        </section>

        <section className="space-y-2" aria-labelledby="bubble-style-options">
          <label id="bubble-style-options" className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
            {CHAT_THEME_COPY.defaultBubbleLabel}
          </label>
          <div className="grid gap-2">
            {CHAT_BUBBLE_PRESETS.map((bubble) => {
              const active = draftBubbleStyleId === bubble.id;
              return (
                <button
                  key={bubble.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDraftBubbleStyleId(bubble.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-[border-color,background-color,transform] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${active ? 'border-primary bg-primary/10' : 'border-border/45 hover:bg-background/50'}`}
                >
                  <span className="flex w-20 shrink-0 flex-col gap-1" aria-hidden="true">
                    <span className={`ml-auto block h-4 w-12 rounded-lg ${bubble.ownClass}`} />
                    <span className={`block h-4 w-14 rounded-lg ${bubble.peerClass}`} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black">{localizeText(bubble.name)}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{localizeText(bubble.description)}</span>
                  </span>
                  {active ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" /> : null}
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-dashed border-border/60 bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Palette size={14} aria-hidden="true" />
              {CHAT_THEME_COPY.roomBackgroundCustomLabel}
            </div>
            <p className="mb-3 text-[11px] leading-4 text-muted-foreground">{CHAT_THEME_COPY.roomBackgroundCustomHint}</p>
            {customPreviewUrl ? (
              <div
                className="mb-3 h-24 overflow-hidden rounded-lg border border-border/60 bg-cover bg-center"
                style={{ backgroundImage: `${CUSTOM_BACKGROUND_OVERLAYS[draftBackgroundTreatment]}, url("${customPreviewUrl}")` }}
                aria-label={localizeText('Xem trước hình nền')}
              />
            ) : null}
            <Input
              value={draftBackgroundUrl}
              onChange={(event) => {
                setDraftBackgroundUrl(event.target.value);
                setPendingBackgroundFile(null);
                setPendingPreviewUrl(null);
                setResetConversationDraft(false);
                if (event.target.value.trim()) setThemeMode('custom');
              }}
              placeholder={CHAT_THEME_COPY.roomBackgroundPlaceholder}
              aria-label={CHAT_THEME_COPY.roomBackgroundLabel}
              className="mb-2"
            />
            <div className="flex flex-wrap gap-2">
              <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2 text-xs font-semibold transition-colors hover:border-primary hover:text-primary">
                <Upload size={14} aria-hidden="true" />
                {isAnalyzingImage ? localizeText('Đang phân tích ảnh…') : CHAT_THEME_COPY.roomBackgroundUpload}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(event) => {
                    void handleBackgroundFile(event.target.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                  disabled={isAnalyzingImage || isUploadingImage}
                />
              </label>
              {hasActiveConversation ? (
                <Button type="button" size="sm" variant="outline" onClick={handleResetDraft} disabled={!hasConversationOverride && !isDirty}>
                  <RotateCcw size={14} aria-hidden="true" />
                  {CHAT_THEME_COPY.resetConversation}
                </Button>
              ) : null}
            </div>
            {isUploadingImage ? <p className="mt-2 text-[11px] text-muted-foreground">{CHAT_THEME_COPY.roomBackgroundUploading}</p> : null}
          </div>
        </section>
      </div>

      <div className="mt-5 flex justify-end border-t border-border/50 pt-4">
        <Button type="button" onClick={() => void handleSave()} disabled={!isDirty || isAnalyzingImage || isUploadingImage}>
          {localizeText('Lưu thay đổi')}
        </Button>
      </div>
    </SurfacePanel>
  );
};

export default RoomThemePanel;
