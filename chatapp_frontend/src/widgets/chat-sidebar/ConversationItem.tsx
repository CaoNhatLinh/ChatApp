import { Pin, PinOff } from 'lucide-react';
import type { Conversation } from '@/features/messenger/types/messenger.types';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/shared/lib/cn';
import { usePresence } from '@/features/presence/model/presence.store';
import { StatusDot } from '@/features/presence/ui/StatusSelector';
import { useFriendStore } from '@/features/relationships/model/friend.store';
import { getConversationLastMessagePreview } from '@/features/messenger/utils/conversation-preview';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onPin?: (id: string) => void;
  onUnpin?: (id: string) => void;
}

const getTimeDistance = (dateInput?: string | number | Date) => {
  if (!dateInput) {
    return '';
  }

  try {
    return formatDistanceToNow(new Date(dateInput), {
      addSuffix: false,
      locale: vi,
    });
  } catch {
    return '';
  }
};

const getPresenceTitle = (
  status: string,
  isOnline: boolean,
  device?: string,
  lastActiveAgo?: string | null,
) => {
  const formatWithDevice = (statusText: string) =>
    device ? `${statusText}${MESSENGER_COPY.presence.deviceSeparator}${device}` : statusText;
  const formatWithLastActive = (statusText: string) =>
    lastActiveAgo ? `${statusText}${MESSENGER_COPY.presence.deviceSeparator}${lastActiveAgo}` : statusText;

  if (isOnline) {
    if (status === 'DND') {
      return formatWithDevice(MESSENGER_COPY.conversationItem.presence.dnd);
    }
    return formatWithDevice(MESSENGER_COPY.conversationItem.presence.online);
  }

  if (lastActiveAgo) return formatWithLastActive(MESSENGER_COPY.conversationItem.presence.offline);
  return MESSENGER_COPY.conversationItem.presence.offline;
};

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onClick,
  onPin,
  onUnpin,
}) => {
  const lastMsg = conversation.lastMessage;
  const isDM = conversation.type === 'dm';
  const otherUser = conversation.otherParticipant;
  const isPinned = conversation.isPinned;
  const { presence: otherPresence } = usePresence(otherUser?.userId ?? '');
  const isOtherOnline = otherPresence?.isOnline ?? false;
  const otherStatus = otherPresence?.status ?? 'OFFLINE';
  const blockedUserIds = useFriendStore((state) => state.blockedUserIds);
  const isLastMsgBlocked = lastMsg?.senderId ? blockedUserIds.has(lastMsg.senderId) : false;
  const unreadCount = conversation.unreadCount ?? 0;

  const displayAvatar = conversation.name?.trim()?.charAt(0) || '?';
  const activeClass = isActive
    ? 'bg-primary/10 border-primary/30 text-foreground'
    : 'border-transparent hover:bg-background/60';

  const presenceTooltip = isDM && otherUser?.userId
    ? getPresenceTitle(
      otherStatus,
      isOtherOnline,
      otherPresence?.device,
      otherPresence?.lastActiveAgo,
    )
    : '';

  const handlePinClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isPinned) {
      onUnpin?.(conversation.conversationId);
    } else {
      onPin?.(conversation.conversationId);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative w-full rounded-2xl border border-transparent p-2.5',
        'flex items-center gap-3 transition-all hover:-translate-y-px',
        activeClass,
      )}
    >
      <div className="relative">
        <div
          className={cn(
            'h-12 w-12 overflow-hidden rounded-xl border-2 transition-all',
            isActive ? 'border-primary/40' : 'border-border/70 group-hover:border-primary/50',
          )}
        >
          {isDM && otherUser?.avatarUrl ? (
            <img src={otherUser.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            <div
              className={cn(
                'h-full w-full flex items-center justify-center font-black text-sm',
                isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
              )}
            >
              {displayAvatar}
            </div>
          )}
        </div>

        {isDM ? (
          <StatusDot
            status={otherStatus}
            isOnline={isOtherOnline}
            size="md"
            className={cn('absolute -right-0.5 -bottom-0.5 border-2 border-background')}
            title={presenceTooltip}
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1 text-left">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <h4 className="truncate text-sm font-black">{conversation.name}</h4>
            {isPinned ? <Pin size={11} className="text-primary" aria-hidden="true" /> : null}
          </div>
          {lastMsg ? (
            <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
              {getTimeDistance(lastMsg.createdAt)}
            </span>
          ) : null}
        </div>

        <div className="flex items-start gap-2">
          <p
            className={cn(
              'line-clamp-1 text-xs font-medium',
              isActive ? 'text-foreground/90' : 'text-muted-foreground',
            )}
            title={getConversationLastMessagePreview(conversation)}
          >
            {lastMsg ? (
              isLastMsgBlocked && !isDM ? (
                <span className="italic">
                  {MESSENGER_COPY.conversationItem.presence.blockedMessage}
                </span>
              ) : (
                getConversationLastMessagePreview(conversation)
              )
            ) : (
              <span className="italic">
                {MESSENGER_COPY.conversationItem.presence.noMessage}
              </span>
            )}
          </p>
          {unreadCount > 0 ? (
            <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={handlePinClick}
        className={cn(
          'absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-border/40',
          'bg-background/80 p-1.5 opacity-0 transition-opacity',
          'group-hover:opacity-100 group-focus-within:opacity-100',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )}
        title={
          isPinned
            ? MESSENGER_COPY.conversationItem.presence.tooltipUnpin
            : MESSENGER_COPY.conversationItem.presence.tooltipPin
        }
      >
        {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
      </button>

      {isActive ? <div className="pointer-events-none absolute inset-y-4 left-1 w-1 rounded-full bg-primary" /> : null}
    </button>
  );
};

export default ConversationItem;
