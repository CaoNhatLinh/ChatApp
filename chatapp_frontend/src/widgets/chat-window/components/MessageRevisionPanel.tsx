import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/Dialog";
import type { SafeRevision } from "./types";
import { getLocale, localizeText } from '@/shared/i18n';

interface MessageRevisionPanelProps {
  isOpen: boolean;
  revisions: SafeRevision[];
  onOpenChange: (open: boolean) => void;
}

export const MessageRevisionPanel = ({
  isOpen,
  revisions,
  onOpenChange,
}: MessageRevisionPanelProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{localizeText('Lịch sử chỉnh sửa')}</DialogTitle>
          <DialogDescription>
            {localizeText('Các phiên bản cũ của tin nhắn được lưu thành bản chỉnh sửa riêng.')}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[420px] overflow-y-auto space-y-3">
          {revisions.length > 0 ? (
            revisions.map((revision) => (
              <div
                key={`${revision.revisionNumber}-${revision.editedAt}`}
                className="rounded-2xl border border-border/50 bg-background/60 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <span>{localizeText('Bản chỉnh sửa')} {revision.revisionNumber}</span>
                  <span>
                    {new Date(revision.editedAt).toLocaleString(getLocale() === 'en' ? 'en-US' : 'vi-VN')}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm font-medium">
                  {revision.content}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{localizeText('Chưa có bản chỉnh sửa nào.')}</p>
          )}
        </div>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
            type="button"
          >
            {localizeText('Đóng')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MessageRevisionPanel;

