import { useMemo } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { EMPTY_TYPING, useMessengerStore } from '@/features/messenger/model/messenger.store';
import { cn } from '@/shared/lib/cn';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';

interface TypingIndicatorProps {
  conversationId: string;
  excludeUserIds?: Set<string>;
  className?: string;
}

export const TypingIndicator = ({
  conversationId,
  excludeUserIds,
  className,
}: TypingIndicatorProps) => {
  const typingEvents = useMessengerStore(state => state.typingUsers[conversationId] || EMPTY_TYPING);
  const { user } = useAuthStore();

  const otherTypingUsers = useMemo(
    () =>
      typingEvents.filter((event) => {
        const id = event.user?.userId;
        if (id === user?.userId) return false;
        return id ? !excludeUserIds?.has(id) : true;
      }),
    [excludeUserIds, typingEvents, user?.userId]
  );

  const typingText = useMemo(() => {
    if (otherTypingUsers.length === 0) return '';
    if (otherTypingUsers.length === 1) {
      const typingUser = otherTypingUsers[0].user;
      return MESSENGER_COPY.typingIndicator.userTyping.replace('{name}', typingUser.displayName);
    }

    return MESSENGER_COPY.typingIndicator.othersTyping.replace(
      '{count}',
      String(otherTypingUsers.length),
    );
  }, [otherTypingUsers]);

  if (otherTypingUsers.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'mb-2 flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card px-4 py-2 text-muted-foreground',
        className
      )}
    >
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
      </div>
      <p className="text-xs font-medium text-muted-foreground">{typingText}</p>
    </div>
  );
};

export default TypingIndicator;
