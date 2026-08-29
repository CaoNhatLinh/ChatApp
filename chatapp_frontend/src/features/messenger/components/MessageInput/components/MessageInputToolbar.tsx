import { BarChart3, Image, Mic, Paperclip, Send, Smile } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import { localizeText } from '@/shared/i18n';

interface MessageInputToolbarProps {
  onAttachFile: () => void;
  onAttachMedia: () => void;
  onOpenPoll: () => void;
  onToggleEmoji: () => void;
  showEmojiPicker: boolean;
  onShowVoice: () => void;
  canShowVoice: boolean;
  onSend: () => void;
  canSend: boolean;
}

export const MessageInputToolbar = ({
  onAttachFile,
  onAttachMedia,
  onOpenPoll,
  onToggleEmoji,
  showEmojiPicker,
  onShowVoice,
  canShowVoice,
  onSend,
  canSend,
}: MessageInputToolbarProps) => {
  return (
    <div className="flex items-end gap-2 px-2">
      <div className="mb-1.5 flex gap-1">
        <Button
          onClick={onAttachFile}
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-primary"
          title={MESSENGER_COPY.messageInput.toolbar.attachFile}
        >
          <Paperclip size={19} />
        </Button>
        <Button
          onClick={onAttachMedia}
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-primary"
          title={MESSENGER_COPY.messageInput.toolbar.attachMedia}
        >
          <Image size={19} />
        </Button>
        <Button
          onClick={onOpenPoll}
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-primary"
          title={MESSENGER_COPY.messageInput.toolbar.createPoll}
        >
          <BarChart3 size={19} />
        </Button>
      </div>

      <div className="mb-1.5 flex items-center gap-1">
        <Button
          onClick={onToggleEmoji}
          type="button"
          variant={showEmojiPicker ? "default" : "ghost"}
          size="icon"
          className={
            showEmojiPicker
              ? "text-primary-foreground neo-shadow"
              : "text-muted-foreground hover:text-primary"
          }
          title={MESSENGER_COPY.messageInput.toolbar.pickEmoji}
        >
          <Smile size={19} />
        </Button>
        <Button
          onClick={onShowVoice}
          disabled={!canShowVoice}
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-primary"
          title={canShowVoice ? MESSENGER_COPY.messageInput.toolbar.callVoice : localizeText("Gọi trực tiếp chỉ hỗ trợ chat 1–1")}
        >
          <Mic size={19} />
        </Button>
      </div>

      <Button
        onClick={onSend}
        disabled={!canSend}
        type="button"
        variant="default"
        size="icon"
        className="ml-2 neo-shadow transition-[color,background-color,border-color,box-shadow,transform,opacity] disabled:translate-y-0 disabled:translate-x-0 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
      >
        <Send size={18} />
      </Button>
    </div>
  );
};

export default MessageInputToolbar;


