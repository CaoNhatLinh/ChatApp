import { ChevronLeft, History, Info, MoreHorizontal, Phone, Search, Video, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/DropdownMenu';
import { Button } from "@/shared/ui/Button";
import { SurfacePanel } from "@/shared/ui/SurfacePanel";
import type { Conversation } from "@/features/messenger/types/messenger.types";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import { Avatar, AvatarFallback, AvatarImage, DefaultUserAvatar } from "@/shared/ui/Avatar";
import { localizeText, useAppLocale } from "@/shared/i18n";
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
  onOpenCallHistory: () => void;
  canCall: boolean;
  callDisabled: boolean;
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
  onOpenCallHistory,
  canCall,
  callDisabled,
}: ConversationHeaderProps) => {
  const { setSidebarOpen } = useMessenger();
  const { locale } = useAppLocale();
  const isGroup = conversation.type === "group";
  const title = conversation.name;

  const { memberCount } = conversation;
  const memberLabel = locale === 'vi' ? 'thành viên' : memberCount === 1 ? 'member' : 'members';
  const statusLabel = isGroup ? `${memberCount.toLocaleString(locale)} ${memberLabel}` : otherStatusLabel;
  const statusClassName = isGroup || isOtherOnline !== true ? "text-muted-foreground" : "text-primary";

  return (
    <SurfacePanel className="chat-conversation-header rounded-none border-x-0 border-t-0 shadow-none">
      <div className="flex items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-4">
        <div className="min-w-0 flex items-center gap-2 sm:gap-3">
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
            <Avatar className="h-8 w-8 border border-border/70 bg-background/45 sm:h-10 sm:w-10">
              <AvatarImage src={conversation.otherParticipant?.avatarUrl} alt="" />
              <AvatarFallback><DefaultUserAvatar alt={localizeText("Ảnh đại diện mặc định")} /></AvatarFallback>
            </Avatar>
            {!isGroup && isOtherOnline ? <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" aria-label={localizeText("Đang trực tuyến")} /> : null}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight sm:text-lg">{title}</h2>
            {statusLabel ? <p className={`whitespace-nowrap text-xs font-medium ${statusClassName}`}>
              {statusLabel}
            </p> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
                disabled={callDisabled}
                aria-label={MESSENGER_COPY.chatWindow.header.voiceTooltip}
                title={MESSENGER_COPY.chatWindow.header.voiceTooltip}
                className="hidden rounded-full sm:inline-flex"
              >
                <Phone size={18} />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={onVideoCall}
                disabled={callDisabled}
                aria-label={MESSENGER_COPY.chatWindow.header.videoTooltip}
                title={MESSENGER_COPY.chatWindow.header.videoTooltip}
                className="hidden rounded-full sm:inline-flex"
              >
                <Video size={18} />
              </Button>
            </>
          ) : null}

          {!isGroup ? <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" data-call-history-trigger="room" aria-label={localizeText('Tùy chọn khác')}>
                <MoreHorizontal size={18} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canCall ? <><DropdownMenuItem className="sm:hidden" disabled={callDisabled} onSelect={onVoiceCall}><Phone size={16} />{MESSENGER_COPY.chatWindow.header.voiceTooltip}</DropdownMenuItem>
                <DropdownMenuItem className="sm:hidden" disabled={callDisabled} onSelect={onVideoCall}><Video size={16} />{MESSENGER_COPY.chatWindow.header.videoTooltip}</DropdownMenuItem></> : null}
              <DropdownMenuItem onSelect={() => requestAnimationFrame(onOpenCallHistory)}><History size={16} />{localizeText('Lịch sử cuộc gọi')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu> : null}

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
