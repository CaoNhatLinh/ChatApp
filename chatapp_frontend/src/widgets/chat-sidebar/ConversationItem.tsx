import { Pin, PinOff } from 'lucide-react';
import type { Conversation } from '@/features/messenger/types/messenger.types';
import { formatDistanceToNow } from 'date-fns';
import { enUS, vi } from 'date-fns/locale';
import { cn } from '@/shared/lib/cn';
import { usePresence } from '@/features/presence/model/presence.store';
import { StatusDot } from '@/features/presence/ui/StatusSelector';
import { useFriendStore } from '@/features/relationships/model/friend.store';
import { getConversationLastMessagePreview } from '@/features/messenger/utils/conversation-preview';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { useTrackPresenceInViewport } from '@/features/presence/hooks/useTrackPresence';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onPin?: (id: string) => void;
  onUnpin?: (id: string) => void;
}

const getTimeDistance = (dateInput: string | number | Date | undefined, locale: 'vi' | 'en') => {
  if (!dateInput) {
    return '';
  }

  try {
    return formatDistanceToNow(new Date(dateInput), {
      addSuffix: false,
      locale: locale === 'en' ? enUS : vi,
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
  const localizedLastActiveAgo = lastActiveAgo === 'just now'
    ? localizeText('Vừa mới')
    : lastActiveAgo === 'offline'
      ? localizeText('Ngoại tuyến')
      : lastActiveAgo ? localizeText(lastActiveAgo) : '';
  const formatWithLastActive = (statusText: string) =>
    localizedLastActiveAgo ? `${statusText}${MESSENGER_COPY.presence.deviceSeparator}${localizedLastActiveAgo}` : statusText;

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
  const { locale } = useAppLocale();
  const lastMsg = conversation.lastMessage;
  const isDM = conversation.type === 'dm';
  const otherUser = conversation.otherParticipant;
  const isPinned = conversation.isPinned;
  const { presence: otherPresence } = usePresence(otherUser?.userId);
  const isOtherOnline = otherPresence?.isOnline ?? false;
  const otherStatus = otherPresence?.status ?? 'OFFLINE';
  const presenceRef = useTrackPresenceInViewport<HTMLDivElement>(
    isDM && otherUser?.userId ? [otherUser.userId] : [],
  );
  const blockedUserIds = useFriendStore((state) => state.blockedUserIds);
  const isLastMsgBlocked = lastMsg?.senderId ? blockedUserIds.has(lastMsg.senderId) : false;
  const unreadCount = conversation.unreadCount;

  const displayAvatar = conversation.name.trim().charAt(0);
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
    <div
      ref={presenceRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group relative w-full rounded-[var(--radius-md)] border border-transparent p-2.5',
        'flex items-center gap-3 transition-[color,background-color,border-color,box-shadow,transform,opacity] hover:-translate-y-px',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
        activeClass,
      )}
    >
      <div className="relative">
        <div
          className={cn(
            'h-12 w-12 overflow-hidden rounded-[var(--radius-md)] border transition-[color,background-color,border-color,box-shadow,transform,opacity]',
            isActive ? 'border-primary/40' : 'border-border/70 group-hover:border-primary/50',
          )}
        >
          {isDM && otherUser?.avatarUrl ? (
            <img src={otherUser.avatarUrl} alt={localizeText('Ảnh đại diện')} className="h-full w-full object-cover" />
          ) : (
            <div
              className={cn(
                'h-full w-full flex items-center justify-center font-semibold text-sm',
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
            <h4 className="truncate text-sm font-semibold">{conversation.name}</h4>
            {isPinned ? <Pin size={11} className="text-primary" aria-hidden="true" /> : null}
          </div>
          {lastMsg ? (
            <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
              {localizeText(getTimeDistance(lastMsg.createdAt, locale))}
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
          'absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-border/60',
          'bg-background/80 p-1.5 opacity-0 transition-opacity',
          'group-hover:opacity-100 group-focus-within:opacity-100',
          'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
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
    </div>
  );
};

export default ConversationItem;

