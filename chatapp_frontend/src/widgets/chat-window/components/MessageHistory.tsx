import { Loader2 } from "lucide-react";
import { MessageItem } from "@/features/messenger/components/chat/MessageItem";
import { TypingIndicator } from "@/features/messenger/components/chat/ui/TypingIndicator";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import type { Message } from "@/features/messenger/types/messenger.types";
import type { RefObject } from "react";
import type { RoomVisualComputed } from "@/features/settings/constants/chat-theme.constants";
import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

interface MessageHistoryProps {
  activeConversationId: string | null;
  messages: Message[];
  roomVisual?: RoomVisualComputed;
  blockedUserIds: Set<string>;
  loading: boolean;
  hasNext: boolean;
  highlightMessageId?: string | null;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onLoadMore: () => void;
  onAction: (action: string, message: Message) => void;
  onUserClick: (userId: string) => void;
  onRetry: (messageId: string) => void;
}

export const MessageHistory = ({
  activeConversationId,
  messages,
  blockedUserIds,
  roomVisual,
  loading,
  hasNext,
  highlightMessageId,
  scrollRef,
  onLoadMore,
  onAction,
  onUserClick,
  onRetry,
}: MessageHistoryProps) => {
  const roomBackground = roomVisual?.backgroundImage;
  const roomStyle = roomVisual?.preset?.overlay
    ? {
        backgroundImage: roomBackground
          ? `${roomVisual.preset.overlay}, url("${roomBackground}")`
          : roomVisual.preset.overlay,
        backgroundSize: roomBackground ? "cover" : undefined,
        backgroundPosition: roomBackground ? "center" : undefined,
      }
    : undefined;

  return (
    <div
      ref={scrollRef}
      className="chat-message-history custom-scrollbar flex-1 space-y-6 overflow-y-auto p-4 sm:p-6"
      style={roomStyle}
    >
      {hasNext ? (
        <motion.div
          className="flex justify-center pb-4"
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.rowReveal}
        >
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="focus-ring inline-flex items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            type="button"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : MESSENGER_COPY.messageHistory.loadMore}
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

        return (
          <MessageItem
            key={msg.messageId}
            dataMessageId={msg.messageId}
            message={msg}
            presenceConversationId={activeConversationId}
            showAvatar={showAvatar}
            isBlocked={isBlocked}
            isHighlighted={isHighlighted}
            onAction={onAction}
            onUserClick={onUserClick}
            onRetry={onRetry}
          />
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

