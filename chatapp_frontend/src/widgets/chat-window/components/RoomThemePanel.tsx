import { Check, ImageIcon, Palette, RotateCcw, Sparkles, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { SurfacePanel } from '@/shared/ui/SurfacePanel';
import { localizeText } from '@/shared/i18n';
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
  return `room-theme-preview room-theme-preview-${themeId}`;
};

const ThemePresetPreview = ({ themeId }: { themeId: RoomThemeId }) => (
  <span className={`room-theme-miniature ${getThemePreviewClassName(themeId)}`} aria-hidden="true">
    <span className="room-theme-miniature__orbit" />
    <span className="room-theme-miniature__signal"><i /><i /><i /></span>
    <span className="room-theme-miniature__messages">
      <i className="room-theme-miniature__peer" />
      <i className="room-theme-miniature__own" />
      <i className="room-theme-miniature__peer room-theme-miniature__short" />
    </span>
  </span>
);

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
  const [panelNotice, setPanelNotice] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);

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
    setPanelNotice(null);
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
      setPanelNotice({ tone: 'error', message: localizeText('Hình nền phải là URL http(s) hợp lệ.') });
      return;
    }

    setIsUploadingImage(Boolean(pendingBackgroundFile));
    if (pendingBackgroundFile) {
      try {
        normalizedBackground = await uploadChatBackground(pendingBackgroundFile);
      } catch {
        setPanelNotice({ tone: 'error', message: localizeText('Không thể tải ảnh nền lên. Vui lòng thử lại.') });
        setIsUploadingImage(false);
        return;
      }
    }

    if (themeMode === 'custom' && !normalizedBackground && !resetConversationDraft) {
      setPanelNotice({ tone: 'error', message: localizeText('Chọn ảnh hoặc dán URL trước khi lưu.') });
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
    setPanelNotice({ tone: 'success', message: hasActiveConversation ? CHAT_THEME_STATUS.conversationSaved : CHAT_THEME_STATUS.defaultsUpdated });
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
    setPanelNotice(null);
  };

  const handleBackgroundFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPanelNotice({ tone: 'error', message: localizeText('Chỉ chấp nhận tệp hình ảnh.') });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPanelNotice({ tone: 'error', message: localizeText('Ảnh nền không được vượt quá 10MB.') });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPendingBackgroundFile(file);
    setPendingPreviewUrl(previewUrl);
    setDraftBackgroundUrl('');
    setThemeMode('custom');
    setResetConversationDraft(false);
    setPanelNotice(null);
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
  const selectedBubbleStyle = CHAT_BUBBLE_PRESETS.find((bubble) => bubble.id === draftBubbleStyleId) ?? CHAT_BUBBLE_PRESETS[0];
  const selectedTheme = ROOM_THEME_PRESETS.find((theme) => theme.id === draftThemeId) ?? ROOM_THEME_PRESETS[0];
  const previewUsesDarkInk = themeMode === 'light';

  return (
    <SurfacePanel className="signal-surface rounded-none border-0 bg-transparent px-4 py-4 shadow-none sm:px-7 sm:py-6">
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-border/50 pb-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-primary/12 text-primary" aria-hidden="true">
              <Palette size={15} />
            </span>
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

      <div
        className={`relative mb-6 min-h-48 overflow-hidden rounded-[var(--radius-lg)] border border-border/60 ${themeMode === 'custom' ? '' : getThemePreviewClassName(draftThemeId)}`}
        style={{
          ...(themeMode === 'custom' && customPreviewUrl ? { backgroundImage: `${CUSTOM_BACKGROUND_OVERLAYS[draftBackgroundTreatment]}, url("${customPreviewUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
          '--room-signal': selectedTheme.signalColor,
          '--room-signal-foreground': selectedTheme.signalForeground,
        } as CSSProperties}
        aria-label={localizeText('Xem trước giao diện cuộc trò chuyện')}
      >
        <div className="absolute inset-0 bg-background/10" />
        <div className={`relative z-10 grid min-h-56 gap-5 p-5 sm:grid-cols-[0.7fr_1.3fr] sm:p-6 ${previewUsesDarkInk ? 'text-slate-950' : 'text-white'}`}>
          <div className="flex flex-col justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] opacity-65"><Sparkles size={12} />{localizeText('Xem trước trực tiếp')}</p>
              <p className="mt-2 text-lg font-semibold">{conversationName || localizeText('Cuộc trò chuyện mới')}</p>
            </div>
            <p className="mt-6 max-w-xs text-xs leading-5 opacity-65">{localizeText('Thử từng lựa chọn. Chỉ khi bấm lưu thì giao diện mới được áp dụng.')}</p>
          </div>
          <div className="flex flex-col justify-end gap-2.5" aria-hidden="true">
            <div className={`max-w-[82%] px-3.5 py-2.5 text-xs ${selectedBubbleStyle.peerClass}`}>
              <p className="leading-5">{localizeText('Tối nay mình chốt phần nào trước?')}</p>
              <p className="mt-1 text-[9px] opacity-55">20:14</p>
            </div>
            <div className={`ml-auto max-w-[76%] px-3.5 py-2.5 text-xs ${selectedBubbleStyle.ownClass}`}>
              <p className="leading-5">{localizeText('Mình hoàn thiện luồng tin nhắn trước nhé.')}</p>
              <p className="mt-1 text-right text-[9px] opacity-60">20:15 · {localizeText('Đã xem')}</p>
            </div>
            <div className={`max-w-[58%] px-3.5 py-2 text-xs ${selectedBubbleStyle.peerClass}`}>
              <p>{localizeText('Ừ, bắt đầu thôi.')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-2" aria-labelledby="room-theme-options">
          <label id="room-theme-options" className="text-xs font-semibold text-muted-foreground">
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
          <div className="grid gap-3 sm:grid-cols-2">
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
                  className={`room-theme-option group relative grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-2 overflow-hidden rounded-[var(--radius-md)] border p-2.5 text-left transition-[border-color,background-color,transform,box-shadow] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${active ? 'is-active border-primary/80 bg-primary/10 shadow-[0_0_0_1px_var(--signal-glow)]' : 'border-border/55 bg-background/35 hover:border-primary/45 hover:bg-background/60'}`}
                >
                  <ThemePresetPreview themeId={theme.id} />
                  <span className="min-w-0">
                    <span className="block text-sm font-black tracking-[-0.015em]">{localizeText(theme.name)}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.signalColor }} aria-hidden="true" />
                      {localizeText(theme.character)}
                    </span>
                    <span className="mt-1.5 block text-[11px] leading-[1.45] text-muted-foreground">{localizeText(theme.description)}</span>
                  </span>
                  <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent group-hover:border-primary/60'}`}>
                    <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                  </span>
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
          <label id="bubble-style-options" className="text-xs font-semibold text-muted-foreground">
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
                  className={`room-theme-option flex w-full items-center gap-3 rounded-[var(--radius-md)] border p-2 text-left transition-[border-color,background-color,transform,box-shadow] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${active ? 'border-primary/80 bg-primary/10 shadow-[0_0_0_1px_var(--signal-glow)]' : 'border-transparent bg-background/35 hover:bg-background/60'}`}
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
            {themeMode === 'custom' ? (
              <fieldset className="mb-3">
                <legend className="mb-2 text-[11px] font-semibold text-muted-foreground">{localizeText('Độ phủ để đọc tin nhắn')}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(['soft', 'strong'] as const).map((treatment) => {
                    const active = draftBackgroundTreatment === treatment;
                    return (
                      <button
                        key={treatment}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setDraftBackgroundTreatment(treatment);
                          setResetConversationDraft(false);
                          setPanelNotice(null);
                        }}
                        className={`flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${active ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border/60 hover:border-primary/35'}`}
                      >
                        <span className={`h-7 w-7 rounded-full border border-border/50 ${treatment === 'strong' ? 'bg-slate-950/80' : 'bg-slate-500/35'}`} aria-hidden="true" />
                        <span><strong className="block">{treatment === 'soft' ? localizeText('Nhẹ') : localizeText('Rõ')}</strong><small className="opacity-65">{treatment === 'soft' ? localizeText('Ảnh còn nổi bật') : localizeText('Ưu tiên chữ')}</small></span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}
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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
        <div className="min-h-5" aria-live="polite">
          {panelNotice ? (
            <p className={`inline-flex items-center gap-2 text-xs font-semibold ${panelNotice.tone === 'error' ? 'text-destructive' : 'text-success'}`}>
              {panelNotice.tone === 'success' ? <Check size={14} aria-hidden="true" /> : <ImageIcon size={14} aria-hidden="true" />}
              {panelNotice.message}
            </p>
          ) : isDirty ? <p className="text-xs text-muted-foreground">{localizeText('Bản xem trước chưa được lưu.')}</p> : null}
        </div>
        <Button type="button" onClick={() => void handleSave()} disabled={!isDirty || isAnalyzingImage || isUploadingImage}>
          {localizeText('Lưu thay đổi')}
        </Button>
      </div>
    </SurfacePanel>
  );
};

export default RoomThemePanel;
