import { Loader2, Pin, PinOff } from 'lucide-react';
import { useRef, useState } from 'react';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import type { Conversation } from '@/features/messenger/types/messenger.types';
import { formatDistanceToNow } from 'date-fns';
import { enUS, vi } from 'date-fns/locale';
import { cn } from '@/shared/lib/cn';
import { usePresence } from '@/features/presence/model/presence.store';
import { StatusDot } from '@/features/presence/ui/StatusSelector';
import { useFriendStore } from '@/features/relationships/model/friend.store';
import { useMessengerStore } from '@/features/messenger/model/messenger.store';
import { getConversationLastMessagePreview } from '@/features/messenger/utils/conversation-preview';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { useTrackPresenceInViewport } from '@/features/presence/hooks/useTrackPresence';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onPin?: (id: string) => void | Promise<void>;
  onUnpin?: (id: string) => void | Promise<void>;
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
  const pinPending = useRef(false);
  const [savingPin, setSavingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const historyUnavailable = useMessengerStore((state) => Boolean(state.unavailableMessageHistory[conversation.conversationId]));
  const lastMsg = historyUnavailable ? null : conversation.lastMessage;
  const isDM = conversation.type === 'dm';
  const otherUser = conversation.otherParticipant;
  const isPinned = conversation.isPinned;
  const { presence: otherPresence } = usePresence(otherUser?.userId);
  const presenceRef = useTrackPresenceInViewport<HTMLDivElement>(
    isDM && otherUser?.userId ? [otherUser.userId] : [],
    isDM ? conversation.conversationId : null,
  );
  const blockedUserIds = useFriendStore((state) => state.blockedUserIds);
  const isLastMsgBlocked = !isDM && Boolean(lastMsg?.senderId && blockedUserIds.has(lastMsg.senderId));
  const preview = historyUnavailable ? localizeText('Chưa xem được tin gần nhất') : isLastMsgBlocked
    ? MESSENGER_COPY.conversationItem.presence.blockedMessage : getConversationLastMessagePreview(conversation);
  const unreadCount = historyUnavailable ? 0 : conversation.unreadCount;

  const activeClass = isActive
    ? 'bg-primary/10 border-primary/30 text-foreground'
    : 'border-transparent hover:bg-background/60';

  const presenceTooltip = isDM && otherUser?.userId && otherPresence
    ? getPresenceTitle(
      otherPresence.status,
      otherPresence.isOnline,
      otherPresence.device,
      otherPresence.lastActiveAgo,
    )
    : undefined;

  const handlePinClick = async () => {
    if (pinPending.current) return;
    pinPending.current = true;
    setSavingPin(true);
    setPinError(null);
    try {
      if (isPinned) await onUnpin?.(conversation.conversationId);
      else await onPin?.(conversation.conversationId);
    } catch (error) {
      setPinError(getUserFacingErrorMessage(error, localizeText(isPinned ? 'Không thể bỏ ghim cuộc trò chuyện.' : 'Không thể ghim cuộc trò chuyện.')));
    } finally { pinPending.current = false; setSavingPin(false); }
  };

  return (
    <div
      ref={presenceRef}
      className={cn(
        'group relative w-full rounded-[var(--radius-md)] border transition-colors',
        activeClass,
      )}
    >
      <button type="button" onClick={onClick} aria-pressed={isActive}
        aria-label={`${conversation.name}${unreadCount > 0 ? `, ${unreadCount} ${localizeText('tin nhắn chưa đọc')}` : ''}`}
        className="flex w-full items-center gap-3 rounded-[inherit] p-2.5 pr-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
      <div className="relative">
        <div
          className={cn(
            'h-12 w-12 overflow-hidden rounded-[var(--radius-md)] border transition-[color,background-color,border-color,box-shadow,transform,opacity]',
            isActive ? 'border-primary/40' : 'border-border/70 group-hover:border-primary/50',
          )}
        >
          {isDM && otherUser?.avatarUrl ? (
            <img src={otherUser.avatarUrl} alt={localizeText('Ảnh đại diện')} className="h-full w-full object-cover" />
          ) : <img src="/noi-default-avatar.webp" alt={localizeText('Ảnh đại diện mặc định')} className="h-full w-full object-cover" />}
        </div>

        {isDM && otherPresence ? (
          <StatusDot
            status={otherPresence.status}
            isOnline={otherPresence.isOnline}
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
              (!lastMsg || isLastMsgBlocked) && 'italic',
            )}
            title={preview}
          >
            {preview}
          </p>
          {unreadCount > 0 ? (
            <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </div>
      </div>

      </button>
      <button
        type="button"
        onClick={handlePinClick}
        disabled={savingPin}
        aria-busy={savingPin}
        className={cn(
          'absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md',
          'transition-colors hover:bg-background/80',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )}
        title={
          isPinned
            ? MESSENGER_COPY.conversationItem.presence.tooltipUnpin
            : MESSENGER_COPY.conversationItem.presence.tooltipPin
        }
      >
        {savingPin ? <Loader2 size={14} className="animate-spin" /> : isPinned ? <PinOff size={14} /> : <Pin size={14} />}
      </button>
      {pinError ? <p role="alert" className="px-3 pb-2 text-xs text-destructive">{pinError}</p> : null}
    </div>
  );
};

export default ConversationItem;

