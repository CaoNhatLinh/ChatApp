import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/Dialog";
import type { SafeRevision } from "./types";

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
          <DialogTitle>Lich su chinh sua</DialogTitle>
          <DialogDescription>
            Cac phien ban cu cua tin nhan duoc luu dang revision rieng.
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
                  <span>Revision {revision.revisionNumber}</span>
                  <span>
                    {new Date(revision.editedAt).toLocaleString("vi-VN")}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm font-medium">
                  {revision.content || "Tin nhan trong"}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Chua co revision nao.</p>
          )}
        </div>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
            type="button"
          >
            Dong
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MessageRevisionPanel;

