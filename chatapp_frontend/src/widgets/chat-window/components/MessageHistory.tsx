import { Loader2 } from "lucide-react";
import { MessageItem } from "@/features/messenger/components/chat/MessageItem";
import { TypingIndicator } from "@/features/messenger/components/chat/ui/TypingIndicator";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import type { Message } from "@/features/messenger/types/messenger.types";
import { Fragment, type CSSProperties, type RefObject } from "react";
import { useAppLocale, localizeText } from '@/shared/i18n';
import type { RoomVisualComputed } from "@/features/settings/constants/chat-theme.constants";
import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

interface MessageHistoryProps {
  activeConversationId: string | null;
  messages: Message[];
  unreadMessageId?: string | null;
  unreadAbove?: boolean;
  roomVisual?: RoomVisualComputed;
  blockedUserIds: Set<string>;
  loading: boolean;
  initialState?: 'loading' | 'loaded';
  paginationState?: 'loading' | 'error';
  hasNext: boolean;
  highlightMessageId?: string | null;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onScroll?: () => void;
  onLoadMore: () => void;
  onAction: (action: string, message: Message) => void;
  onUserClick: (userId: string) => void;
  onRetry: (messageId: string) => Promise<'unconfirmed' | void>;
}

type RoomHistoryStyle = CSSProperties & {
  '--room-signal': string;
  '--room-signal-foreground': string;
};

export const MessageHistory = ({
  activeConversationId,
  messages,
  unreadMessageId,
  unreadAbove,
  blockedUserIds,
  roomVisual,
  loading,
  initialState,
  paginationState,
  hasNext,
  highlightMessageId,
  scrollRef,
  onScroll,
  onLoadMore,
  onAction,
  onUserClick,
  onRetry,
}: MessageHistoryProps) => {
  const { locale } = useAppLocale();
  const dateFormatter = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'vi-VN', { dateStyle: 'medium' });
  const roomBackground = roomVisual?.backgroundImage;
  const roomStyle: RoomHistoryStyle | undefined = roomVisual?.backgroundOverlay
    ? {
        backgroundImage: roomBackground
          ? `${roomVisual.backgroundOverlay}, url("${roomBackground}")`
          : roomVisual.backgroundOverlay,
        backgroundSize: roomBackground ? "cover" : undefined,
        backgroundPosition: roomBackground ? "center" : undefined,
        '--room-signal': roomVisual.signalColor,
        '--room-signal-foreground': roomVisual.signalForeground,
      } as RoomHistoryStyle
    : undefined;

  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label={localizeText('Lịch sử tin nhắn')}
      tabIndex={-1}
      onScroll={onScroll}
      className="chat-message-history custom-scrollbar flex-1 space-y-6 overflow-y-auto p-4 sm:p-6"
      data-room-mode={roomVisual?.preset.mode}
      style={roomStyle}
    >
      {!messages.length && initialState && (initialState === 'loading' || !hasNext) ? <p role="status" className="mx-auto w-fit rounded-full bg-background px-3 py-1 text-sm text-foreground">
        {localizeText(initialState === 'loading' ? 'Đang tải tin nhắn…' : 'Chưa có tin nhắn')}
      </p> : null}
      {unreadAbove ? <p className="text-center text-xs text-foreground">{localizeText('Còn tin chưa đọc ở phía trên. Tải tin cũ để xem tiếp.')}</p> : null}
      {hasNext ? (
        <motion.div
          className="flex items-center justify-center gap-2 pb-4"
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.rowReveal}
        >
          {paginationState === 'error' ? <p role="alert" className="rounded-lg bg-background px-3 py-1 text-sm text-foreground">
            {localizeText('Chưa tải được tin nhắn cũ.')}
          </p> : null}
          <button
            onClick={onLoadMore}
            disabled={loading || paginationState === 'loading'}
            aria-busy={paginationState === 'loading'}
            className="signal-control focus-ring inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-primary/25 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            type="button"
          >
            {paginationState === 'loading' ? <><Loader2 size={12} className="motion-safe:animate-spin" aria-hidden="true" />{localizeText('Đang tải tin nhắn…')}</>
              : paginationState === 'error' ? localizeText('Thử lại') : MESSENGER_COPY.messageHistory.loadMore}
          </button>
        </motion.div>
      ) : null}

      {messages.map((msg, idx) => {
        const prevMessage = idx > 0 ? messages[idx - 1] : null;
        const showAvatar =
          idx === 0 || (prevMessage?.sender.userId !== msg.sender.userId);
        const isBlocked =
          Boolean(msg.senderBlockedByViewer) || blockedUserIds.has(msg.sender.userId);
        const isHighlighted = Boolean(highlightMessageId && msg.messageId === highlightMessageId);
        const date = new Date(msg.createdAt);
        const previousDate = prevMessage ? new Date(prevMessage.createdAt) : null;
        const startsDay = Number.isFinite(date.getTime()) && (!previousDate || date.toDateString() !== previousDate.toDateString());

        return (
          <Fragment key={msg.messageId}>
          {startsDay ? <div className="flex justify-center py-2"><time dateTime={msg.createdAt} className="rounded-full bg-background px-3 py-1 text-xs font-medium text-foreground">{dateFormatter.format(date)}</time></div> : null}
          {unreadMessageId === msg.messageId ? <div role="separator" aria-label={localizeText('Tin nhắn chưa đọc')} className="flex items-center gap-3 py-2 text-xs font-semibold text-foreground"><span className="h-px flex-1 bg-border" />{localizeText('Tin nhắn chưa đọc')}<span className="h-px flex-1 bg-border" /></div> : null}
          <MessageItem
            dataMessageId={msg.messageId}
            message={msg}
            presenceConversationId={activeConversationId}
            showAvatar={showAvatar}
            isBlocked={isBlocked}
            isHighlighted={isHighlighted}
            roomBubbleStyle={roomVisual?.messageBubbleStyle}
            onAction={onAction}
            onUserClick={onUserClick}
            onRetry={onRetry}
          />
          </Fragment>
        );
      })}

      {activeConversationId && (
        <TypingIndicator
          conversationId={activeConversationId}
          excludeUserIds={blockedUserIds}
          className="pl-14"
        />
      )}
    </div>
  );
};

export default MessageHistory;

