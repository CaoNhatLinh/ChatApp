import { X, FileText } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import { localizeText, useAppLocale } from "@/shared/i18n";

interface MessageInputDraftPanelProps {
  replyingTo?: { content: string } | null;
  editingMessage?: { content: string } | null;
  selectedFiles: File[];
  onCancelReply?: () => void;
  onCancelEdit?: () => void;
  onRemoveFile: (index: number) => void;
}

export const MessageInputDraftPanel = ({
  replyingTo,
  editingMessage,
  selectedFiles,
  onCancelReply,
  onCancelEdit,
  onRemoveFile,
}: MessageInputDraftPanelProps) => {
  const { locale } = useAppLocale();

  if (!replyingTo && !editingMessage && selectedFiles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 px-2 sm:px-3" lang={locale}>
      {replyingTo && !editingMessage ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                {MESSENGER_COPY.messageInput.draftPanel.replyLabel}
              </p>
              <p className="line-clamp-2 text-xs font-semibold text-foreground/80">
                {replyingTo.content}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancelReply}
              aria-label={localizeText("Hủy trả lời")}
              className="text-muted-foreground hover:text-primary"
            >
              <X size={14} />
            </Button>
          </div>
        </div>
      ) : null}

      {editingMessage ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                {MESSENGER_COPY.messageInput.draftPanel.editLabel}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancelEdit}
              aria-label={localizeText("Hủy chỉnh sửa")}
              className="text-muted-foreground hover:text-primary"
            >
              <X size={14} />
            </Button>
          </div>
        </div>
      ) : null}

      {selectedFiles.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-xs font-semibold"
            >
              <FileText size={14} />
              <span className="max-w-[180px] truncate">{file.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveFile(index)}
                aria-label={localizeText(`Xóa tệp ${file.name}`)}
                className="h-6 px-1 text-muted-foreground hover:text-destructive"
              >
                <X size={12} />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default MessageInputDraftPanel;
