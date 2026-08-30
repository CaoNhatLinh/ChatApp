import { Info, MessageSquare, Palette, Phone, Search, Video } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { SurfacePanel } from "@/shared/ui/SurfacePanel";
import type { Conversation } from "@/features/messenger/types/messenger.types";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";

interface ConversationHeaderProps {
  conversation: Conversation;
  isInfoOpen: boolean;
  isOtherOnline: boolean | null;
  otherStatusLabel: string | null;
  onSearch: () => void;
  onToggleInfo: () => void;
  onVideoCall: () => void;
  onVoiceCall: () => void;
  onOpenRoomTheme: () => void;
  canCall: boolean;
}

export const ConversationHeader = ({
  conversation,
  isInfoOpen,
  isOtherOnline,
  otherStatusLabel,
  onSearch,
  onToggleInfo,
  onVideoCall,
  onVoiceCall,
  onOpenRoomTheme,
  canCall,
}: ConversationHeaderProps) => {
  const isGroup = conversation.type === "group";
  const title = conversation.name;

  const statusLabel = isGroup ? `${conversation.memberCount} ${MESSENGER_COPY.chatWindow.status.groupMemberSuffix}` : otherStatusLabel;
  const statusClassName = isGroup || isOtherOnline !== true ? "text-muted-foreground" : "text-primary";

  return (
    <SurfacePanel className="chat-conversation-header rounded-none border-x-0 border-t-0 shadow-none">
      <div className="flex items-center justify-between gap-4 px-4 py-4 pl-20 md:pl-4">
        <div className="min-w-0 flex items-center gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
            {statusLabel ? <p className={`text-xs font-medium ${statusClassName}`}>
              {statusLabel}
            </p> : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenRoomTheme}
            aria-label={MESSENGER_COPY.chatWindow.header.themeTooltip}
            title={MESSENGER_COPY.chatWindow.header.themeTooltip}
            className="hidden rounded-full sm:inline-flex"
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

          {canCall ? (
            <>
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
            </>
          ) : null}

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
