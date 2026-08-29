import { useCallback, useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { ConversationItem } from "./ConversationItem";
import type { Conversation } from "@/features/messenger/types/messenger.types";
import { EmptyState } from "@/shared/ui/EmptyState";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";

interface SidebarConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  loading: boolean;
  searchTerm: string;
  onSelectConversation: (conversationId: string) => void;
  onPinConversation: (conversationId: string) => void;
  onUnpinConversation: (conversationId: string) => void;
  hasNext: boolean;
  loadingMore: boolean;
  onLoadMore: () => Promise<void>;
}

export const SidebarConversationList = ({
  conversations,
  activeConversationId,
  loading,
  searchTerm,
  onSelectConversation,
  onPinConversation,
  onUnpinConversation,
  hasNext,
  loadingMore,
  onLoadMore,
}: SidebarConversationListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreInFlightRef = useRef(false);

  const loadMore = useCallback(() => {
    if (loadMoreInFlightRef.current || loading || loadingMore || !hasNext) return;
    loadMoreInFlightRef.current = true;
    void onLoadMore().finally(() => {
      loadMoreInFlightRef.current = false;
    });
  }, [hasNext, loading, loadingMore, onLoadMore]);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = loadMoreSentinelRef.current;
    if (
      !root ||
      !sentinel ||
      !hasNext ||
      loading ||
      loadingMore ||
      typeof IntersectionObserver === "undefined" ||
      root.scrollHeight <= root.clientHeight
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { root, rootMargin: "240px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [conversations.length, hasNext, loadMore, loading, loadingMore]);

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare size={34} />}
        title={
          searchTerm
            ? MESSENGER_COPY.sidebar.emptyTitleWithFilter
            : MESSENGER_COPY.sidebar.emptyTitleDefault
        }
        description={searchTerm ? MESSENGER_COPY.sidebar.emptyHintWithFilter : MESSENGER_COPY.sidebar.emptyHintDefault}
      />
    );
  }

  return (
    <div ref={scrollRef} className="overflow-y-auto custom-scrollbar px-2 py-2 pb-4">
      <div className="space-y-1">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.conversationId}
            conversation={conversation}
            isActive={activeConversationId === conversation.conversationId}
            onClick={() => onSelectConversation(conversation.conversationId)}
            onPin={onPinConversation}
            onUnpin={onUnpinConversation}
          />
        ))}
      </div>

      {loading || loadingMore ? (
        <div className="py-4 text-center">
          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary/30 border-t-primary animate-spin text-primary" />
        </div>
      ) : null}
      {hasNext ? <div ref={loadMoreSentinelRef} className="h-px" aria-hidden="true" /> : null}
      {hasNext && !loadingMore ? (
        <button
          type="button"
          onClick={loadMore}
          className="mt-2 w-full rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {MESSENGER_COPY.sidebar.loadMore}
        </button>
      ) : null}
    </div>
  );
};

export default SidebarConversationList;
