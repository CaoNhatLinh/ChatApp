import type { ReactNode } from "react";
import { BarChart3, Check, Image, Mic, Paperclip, Plus, Send, Smile } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import { localizeText, useAppLocale } from '@/shared/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu';

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
  isEditing: boolean;
  children: ReactNode;
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
  isEditing,
  children,
}: MessageInputToolbarProps) => {
  const { locale } = useAppLocale();

  return (
    <div className="flex items-end gap-2 px-2" lang={locale}>
      {!isEditing ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={localizeText('Thêm nội dung')}
              title={localizeText('Thêm nội dung')}
              className="mb-1.5 shrink-0 rounded-full text-muted-foreground hover:text-primary"
            >
              <Plus size={20} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="min-w-48 border-white/10 bg-[#111922] text-slate-100">
            <DropdownMenuItem onSelect={onAttachFile} className="gap-2.5 py-2.5 focus:bg-white/8 focus:text-slate-50">
              <Paperclip size={16} aria-hidden="true" />
              {MESSENGER_COPY.messageInput.toolbar.attachFile}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onAttachMedia} className="gap-2.5 py-2.5 focus:bg-white/8 focus:text-slate-50">
              <Image size={16} aria-hidden="true" />
              {MESSENGER_COPY.messageInput.toolbar.attachMedia}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenPoll} className="gap-2.5 py-2.5 focus:bg-white/8 focus:text-slate-50">
              <BarChart3 size={16} aria-hidden="true" />
              {MESSENGER_COPY.messageInput.toolbar.createPoll}
            </DropdownMenuItem>
            {canShowVoice ? (
              <DropdownMenuItem onSelect={onShowVoice} className="gap-2.5 py-2.5 focus:bg-white/8 focus:text-slate-50">
                <Mic size={16} aria-hidden="true" />
                {MESSENGER_COPY.messageInput.toolbar.callVoice}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {children}

      <div className="mb-1.5 flex shrink-0 items-center gap-1">
        {!isEditing ? (
          <Button
          onClick={onToggleEmoji}
          type="button"
          variant={showEmojiPicker ? "default" : "ghost"}
          size="icon"
          aria-label={MESSENGER_COPY.messageInput.toolbar.pickEmoji}
          className={
            showEmojiPicker
              ? "text-primary-foreground neo-shadow"
              : "text-muted-foreground hover:text-primary"
          }
          title={MESSENGER_COPY.messageInput.toolbar.pickEmoji}
        >
          <Smile size={19} />
          </Button>
        ) : null}
      </div>

      {(canSend || isEditing) ? <Button
        onClick={onSend}
        disabled={!canSend}
        type="button"
        variant="default"
        size="icon"
        aria-label={localizeText(isEditing ? "Lưu thay đổi" : "Gửi tin")}
        title={localizeText(isEditing ? "Lưu thay đổi" : "Gửi tin")}
        className="mb-1.5 shrink-0 neo-shadow transition-[color,background-color,border-color,box-shadow,transform,opacity] disabled:translate-y-0 disabled:translate-x-0 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
      >
        {isEditing ? <Check size={18} /> : <Send size={18} />}
      </Button> : null}
    </div>
  );
};

export default MessageInputToolbar;


