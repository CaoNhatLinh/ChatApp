import { Button } from '@/shared/ui/Button';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';

interface MessageInputBlockedStateProps {
  hasBlocked?: boolean;
  isBlockedBy?: boolean;
  onUnblock: () => void;
}

export const MessageInputBlockedState = ({
  hasBlocked,
  isBlockedBy,
  onUnblock,
}: MessageInputBlockedStateProps) => {
  if (hasBlocked) {
    return (
      <div className="flex flex-col items-center justify-center p-4 rounded-[1.5rem] border border-border/50 bg-card/80">
        <span className="text-muted-foreground font-medium text-sm">
          {MESSENGER_COPY.messageInputBlocked.blockedByMe}
        </span>
        <Button
          onClick={onUnblock}
          className="mt-3 px-5 py-2 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-opacity text-sm shadow-md"
        >
          {MESSENGER_COPY.messageInputBlocked.unblockAction}
        </Button>
      </div>
    );
  }

  if (isBlockedBy) {
    return (
      <div className="flex items-center justify-center p-4 rounded-[2rem] border border-border/50 bg-card/75">
        <span className="text-muted-foreground font-medium text-sm">
          {MESSENGER_COPY.messageInputBlocked.blockedByOther}
        </span>
      </div>
    );
  }

  return null;
};
