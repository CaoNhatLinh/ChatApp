import { ChevronLeft, Info, Phone, Search, Video, X } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { SurfacePanel } from "@/shared/ui/SurfacePanel";
import type { Conversation } from "@/features/messenger/types/messenger.types";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import { Avatar, AvatarFallback, AvatarImage, DefaultUserAvatar } from "@/shared/ui/Avatar";
import { localizeText } from "@/shared/i18n";
import { useMessenger } from "@/features/messenger/model/useMessenger";

interface ConversationHeaderProps {
  conversation: Conversation;
  isInfoOpen: boolean;
  isOtherOnline: boolean | null;
  otherStatusLabel: string | null;
  onSearch: () => void;
  onToggleInfo: () => void;
  onVideoCall: () => void;
  onVoiceCall: () => void;
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
  canCall,
}: ConversationHeaderProps) => {
  const { setSidebarOpen } = useMessenger();
  const isGroup = conversation.type === "group";
  const title = conversation.name;

  const statusLabel = isGroup ? `${conversation.memberCount} ${MESSENGER_COPY.chatWindow.status.groupMemberSuffix}` : otherStatusLabel;
  const statusClassName = isGroup || isOtherOnline !== true ? "text-muted-foreground" : "text-primary";

  return (
    <SurfacePanel className="chat-conversation-header rounded-none border-x-0 border-t-0 shadow-none">
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <div className="min-w-0 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label={localizeText("Quay lại danh sách hội thoại")}
            className="-ml-2 shrink-0 rounded-full md:hidden"
          >
            <ChevronLeft size={21} />
          </Button>
          <div className="relative">
            <Avatar className="h-10 w-10 border border-white/10">
              <AvatarImage src={conversation.otherParticipant?.avatarUrl} alt="" />
              <AvatarFallback><DefaultUserAvatar alt={localizeText("Ảnh đại diện mặc định")} /></AvatarFallback>
            </Avatar>
            {!isGroup && isOtherOnline ? <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0d1720] bg-emerald-400" aria-label={localizeText("Đang trực tuyến")} /> : null}
          </div>
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
            onClick={onSearch}
            aria-label={MESSENGER_COPY.chatWindow.header.searchTooltip}
            title={MESSENGER_COPY.chatWindow.header.searchTooltip}
            className="hidden rounded-full sm:inline-flex"
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
            {isInfoOpen ? <X size={18} /> : <Info size={18} />}
          </Button>
        </div>
      </div>
    </SurfacePanel>
  );
};

export default ConversationHeader;
