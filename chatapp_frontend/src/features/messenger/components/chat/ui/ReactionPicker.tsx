import { SmilePlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { reactToMessage } from '@/features/messenger/api/messenger.api';
import { logger } from '@/shared/lib/logger';
import { localizeText } from '@/shared/i18n';

const REACTIONS = [
  { emoji: '\u{1F44D}', key: 'like', label: 'Thích' },
  { emoji: '\u{2764}\u{FE0F}', key: 'love', label: 'Yêu thích' },
  { emoji: '\u{1F602}', key: 'laugh', label: 'Cười' },
  { emoji: '\u{1F61B}', key: 'wow', label: 'Ngạc nhiên' },
  { emoji: '\u{1F622}', key: 'sad', label: 'Buồn' },
  { emoji: '\u{1F620}', key: 'angry', label: 'Tức giận' },
] as const;

interface ReactionPickerProps {
  conversationId: string;
  messageBucket?: string;
  messageId: string;
  onReactionAdded?: () => void;
}

const ReactionPicker = ({
  conversationId,
  messageBucket,
  messageId,
  onReactionAdded,
}: ReactionPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleReaction = useCallback(async (emojiKey: string) => {
    if (loading) return;

    setLoading(true);
    try {
      if (!messageBucket) throw new Error('Message bucket is required');
      await reactToMessage(conversationId, messageBucket, messageId, emojiKey);
      onReactionAdded?.();
      setIsOpen(false);
    } catch (error) {
      logger.error('[ReactionPicker] Failed to add reaction:', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [conversationId, loading, messageBucket, messageId, onReactionAdded]);

  return (
    <div ref={pickerRef} className="relative inline-flex">
      <button
        type="button"
        disabled={!messageBucket || loading}
        onClick={() => setIsOpen((value) => !value)}
        className="rounded-full p-1 text-muted-foreground transition-opacity hover:text-primary group-hover:opacity-100"
        title={localizeText("Thêm cảm xúc")}
      >
        <SmilePlus size={16} />
      </button>

      {isOpen ? (
        <div className="absolute bottom-full left-0 z-50 mb-1 flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 shadow-lg">
          {REACTIONS.map(({ emoji, key, label }) => (
            <button
              type="button"
              key={key}
              onClick={() => void handleReaction(key)}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-primary/10 disabled:opacity-50"
              title={localizeText(label)}
            >
              <span className="text-lg leading-none">{emoji}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export { ReactionPicker };
export default ReactionPicker;
