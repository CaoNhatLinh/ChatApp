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
}

export const SidebarConversationList = ({
  conversations,
  activeConversationId,
  loading,
  searchTerm,
  onSelectConversation,
  onPinConversation,
  onUnpinConversation,
}: SidebarConversationListProps) => {
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
    <div className="overflow-y-auto custom-scrollbar px-2 py-2 pb-4">
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

      {loading ? (
        <div className="py-4 text-center">
          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary/30 border-t-primary animate-spin text-primary" />
        </div>
      ) : null}
    </div>
  );
};

export default SidebarConversationList;
