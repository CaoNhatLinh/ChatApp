import { ArrowLeft, Info, MessageSquare, Palette, Phone, Search, Video } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { SurfacePanel } from "@/shared/ui/SurfacePanel";
import type { Conversation } from "@/features/messenger/types/messenger.types";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";

interface ConversationHeaderProps {
  conversation: Conversation;
  isInfoOpen: boolean;
  isOtherOnline: boolean;
  otherStatusLabel: string;
  canGoBack: boolean;
  onSearch: () => void;
  onBack: () => void;
  onToggleInfo: () => void;
  onVideoCall: () => void;
  onVoiceCall: () => void;
  onOpenRoomTheme: () => void;
}

export const ConversationHeader = ({
  conversation,
  isInfoOpen,
  isOtherOnline,
  otherStatusLabel,
  canGoBack,
  onSearch,
  onBack,
  onToggleInfo,
  onVideoCall,
  onVoiceCall,
  onOpenRoomTheme,
}: ConversationHeaderProps) => {
  const isGroup = conversation.type === "group";
  const title =
    conversation.type === "dm"
      ? conversation.otherParticipant?.displayName || MESSENGER_COPY.chatWindow.header.dmFallback
      : conversation.name || MESSENGER_COPY.chatWindow.header.groupFallback;

  const statusLabel = isGroup ? `${conversation.memberCount} ${MESSENGER_COPY.chatWindow.status.groupMemberSuffix}` : otherStatusLabel;
  const statusClassName = isGroup || !isOtherOnline ? "text-muted-foreground" : "text-primary";

  return (
    <SurfacePanel className="rounded-none border-x-0 border-t-0">
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0 flex items-center gap-3">
          {canGoBack ? (
            <Button
              variant="outline"
              size="icon"
              onClick={onBack}
              className="rounded-full bg-card/40"
              aria-label={MESSENGER_COPY.chatWindow.header.goBackLabel}
            >
              <ArrowLeft size={18} />
            </Button>
          ) : null}

          <div className="min-w-0">
            <h2 className="font-black text-lg tracking-tight truncate">{title}</h2>
            <p className={`text-xs font-bold uppercase tracking-widest ${statusClassName}`}>
              {statusLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenRoomTheme}
            aria-label={MESSENGER_COPY.chatWindow.header.themeTooltip}
            title={MESSENGER_COPY.chatWindow.header.themeTooltip}
            className="rounded-full"
          >
            <Palette size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSearch}
            aria-label={MESSENGER_COPY.chatWindow.header.searchTooltip}
            title={MESSENGER_COPY.chatWindow.header.searchTooltip}
            className="rounded-full"
          >
            <Search size={18} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onVoiceCall}
            aria-label={MESSENGER_COPY.chatWindow.header.voiceTooltip}
            title={MESSENGER_COPY.chatWindow.header.voiceTooltip}
            className="rounded-full"
          >
            <Phone size={18} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onVideoCall}
            aria-label={MESSENGER_COPY.chatWindow.header.videoTooltip}
            title={MESSENGER_COPY.chatWindow.header.videoTooltip}
            className="rounded-full"
          >
            <Video size={18} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleInfo}
            aria-label={isInfoOpen ? MESSENGER_COPY.chatWindow.header.themeInfo : MESSENGER_COPY.chatWindow.header.themeInfoClosed}
            title={isInfoOpen ? MESSENGER_COPY.chatWindow.header.themeInfo : MESSENGER_COPY.chatWindow.header.themeInfoClosed}
            className="rounded-full"
          >
            {isInfoOpen ? <MessageSquare size={18} /> : <Info size={18} />}
          </Button>
        </div>
      </div>
    </SurfacePanel>
  );
};

export default ConversationHeader;

