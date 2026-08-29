import { Palette, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { SurfacePanel } from '@/shared/ui/SurfacePanel';
import { localizeText } from '@/shared/i18n';
import { CHAT_BUBBLE_PRESETS, CHAT_THEME_COPY, CHAT_THEME_STATUS, ROOM_THEME_PRESETS } from '@/features/settings/constants/chat-theme.constants';
import type {
  ChatBubbleStyleId,
  RoomThemeId,
} from '@/features/settings/constants/chat-theme.constants';

interface RoomThemePanelProps {
  conversationId: string | null;
  conversationName: string;
  defaultRoomThemeId: RoomThemeId;
  defaultBubbleStyleId: ChatBubbleStyleId;
  activeRoomThemeId: RoomThemeId;
  activeBackgroundImage: string;
  hasConversationOverride: boolean;
  onSetDefaultRoomTheme: (themeId: RoomThemeId) => void;
  onSetRoomTheme: (themeId: RoomThemeId) => void;
  onSetBubbleStyle: (bubbleStyleId: ChatBubbleStyleId) => void;
  onSetBackgroundImage: (imageUrl: string) => void;
  onClearConversationTheme: () => void;
  onClearConversationBackground: () => void;
}

const getLabel = (themeId: RoomThemeId) => {
  const theme = ROOM_THEME_PRESETS.find((candidate) => candidate.id === themeId);
  if (!theme) throw new Error(`Unknown room theme: ${themeId}`);
  return localizeText(theme.name);
};

export const RoomThemePanel = ({
  conversationId,
  conversationName,
  defaultRoomThemeId,
  defaultBubbleStyleId,
  activeRoomThemeId,
  activeBackgroundImage,
  hasConversationOverride,
  onSetDefaultRoomTheme,
  onSetRoomTheme,
  onSetBubbleStyle,
  onSetBackgroundImage,
  onClearConversationTheme,
  onClearConversationBackground,
}: RoomThemePanelProps) => {
  const [localBackgroundUrl, setLocalBackgroundUrl] = useState(activeBackgroundImage);

  const hasActiveConversation = Boolean(conversationId);

  useEffect(() => {
    setLocalBackgroundUrl(activeBackgroundImage);
  }, [activeBackgroundImage]);

  const roomOptions = useMemo(
    () => ROOM_THEME_PRESETS,
    [],
  );

  return (
    <SurfacePanel className="mx-4 rounded-xl border-border/40 bg-card/90 px-3 py-3 sm:px-5 sm:py-4">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.14em] text-foreground">
            {CHAT_THEME_COPY.panelTitle}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasActiveConversation
              ? CHAT_THEME_COPY.activeRoomHint(conversationName)
              : CHAT_THEME_COPY.noActiveConversation}
          </p>
        </div>
        <div className="text-xs font-semibold text-muted-foreground">
          {hasActiveConversation ? CHAT_THEME_STATUS.loading : CHAT_THEME_STATUS.noConversationSelected}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="space-y-2">
          <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
            {CHAT_THEME_COPY.defaultThemeLabel}
          </label>
          <div className="grid gap-2">
            {roomOptions.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  if (hasActiveConversation) {
                    onSetRoomTheme(theme.id);
                  } else {
                    onSetDefaultRoomTheme(theme.id);
                  }
                }}
                className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                  activeRoomThemeId === theme.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/45 hover:bg-background/50'
                }`}
              >
                <p className="text-sm font-black">{localizeText(theme.name)}</p>
                <p className="text-[11px] text-muted-foreground">{localizeText(theme.description)}</p>
              </button>
            ))}
          </div>
          {hasActiveConversation ? (
            <div className="text-[11px] text-muted-foreground/85">
              {CHAT_THEME_COPY.showMessage}: {getLabel(activeRoomThemeId)}
            </div>
          ) : null}
        </section>

        <section className="space-y-2">
          <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
            {CHAT_THEME_COPY.defaultBubbleLabel}
          </label>
          <div className="grid gap-2">
            {CHAT_BUBBLE_PRESETS.map((bubble) => (
              <button
                key={bubble.id}
                type="button"
                onClick={() => onSetBubbleStyle(bubble.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                  defaultBubbleStyleId === bubble.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/45 hover:bg-background/50'
                }`}
              >
                <p className="text-sm font-black">{localizeText(bubble.name)}</p>
                <p className="text-[11px] text-muted-foreground">{localizeText(bubble.description)}</p>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-dashed border-border/60 bg-background/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Palette size={14} />
                {CHAT_THEME_COPY.roomBackgroundLabel}
              </div>
              {hasActiveConversation && hasConversationOverride ? (
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">
                  {CHAT_THEME_COPY.activeRoomHint(conversationName)}
                </span>
              ) : null}
            </div>

            <Input
              value={localBackgroundUrl}
              onChange={(event) => setLocalBackgroundUrl(event.target.value)}
              placeholder={CHAT_THEME_COPY.roomBackgroundPlaceholder}
              className="mb-2"
            />

            {hasActiveConversation ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => onSetBackgroundImage(localBackgroundUrl)}
                >
                  {CHAT_THEME_COPY.roomBackgroundApply}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setLocalBackgroundUrl('');
                    onClearConversationBackground();
                  }}
                >
                  {CHAT_THEME_COPY.roomBackgroundClear}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setLocalBackgroundUrl('');
                    onSetRoomTheme(defaultRoomThemeId);
                    onClearConversationTheme();
                  }}
                >
                  <RotateCcw size={14} />
                  {CHAT_THEME_COPY.resetConversation}
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </SurfacePanel>
  );
};

export default RoomThemePanel;
