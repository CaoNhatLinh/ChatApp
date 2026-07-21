import { X, FileText } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";

interface MessageInputDraftPanelProps {
  replyingTo?: { content?: string } | null;
  editingMessage?: { content?: string } | null;
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
  if (!replyingTo && !editingMessage && selectedFiles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 px-2 sm:px-3">
      {replyingTo && !editingMessage ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                {MESSENGER_COPY.messageInput.draftPanel.replyLabel}
              </p>
              <p className="line-clamp-2 text-xs font-semibold text-foreground/80">
                {replyingTo.content || MESSENGER_COPY.messageInput.draftPanel.unknownReplyContent}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancelReply}
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
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                {MESSENGER_COPY.messageInput.draftPanel.editLabel}
              </p>
              <p className="line-clamp-2 text-xs font-semibold text-foreground/80">
                {editingMessage.content || MESSENGER_COPY.messageInput.draftPanel.unknownEditContent}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancelEdit}
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

