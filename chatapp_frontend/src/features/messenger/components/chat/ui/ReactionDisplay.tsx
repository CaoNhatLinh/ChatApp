import { reactToMessage } from '@/features/messenger/api/messenger.api';
import { logger } from '@/shared/lib/logger';
import { cn } from '@/shared/lib/cn';

interface ReactionDisplayProps {
  reactions: Array<{
    emoji: string;
    count: number;
    reactedByCurrentUser: boolean;
  }>;
  messageId: string;
  onToggle?: () => void;
}

const EMOJI_MAP: Record<string, string> = {
  like: '\u{1F44D}',
  love: '\u{2764}\u{FE0F}',
  laugh: '\u{1F602}',
  wow: '\u{1F61B}',
  sad: '\u{1F622}',
  angry: '\u{1F620}',
};

export const ReactionDisplay = ({
  reactions,
  messageId,
  onToggle,
}: ReactionDisplayProps) => {
  if (reactions.length === 0) {
    return null;
  }

  const handleToggle = async (emojiKey: string) => {
    try {
      await reactToMessage(messageId, emojiKey);
      onToggle?.();
    } catch (error) {
      logger.error('[ReactionDisplay] Toggle failed:', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {reactions.map(({ emoji, count, reactedByCurrentUser }) => {
        const displayEmoji = EMOJI_MAP[emoji] ?? emoji;

        return (
          <button
            type="button"
            key={emoji}
            onClick={() => void handleToggle(emoji)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
              reactedByCurrentUser
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border/40 bg-background text-muted-foreground hover:bg-muted/30'
            )}
          >
            <span>{displayEmoji}</span>
            <span>{count}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ReactionDisplay;
