import { useEffect, useRef, useState } from "react";
import type { Conversation } from "@/types/conversation";
import { ChatProvider } from "@/context/SimpleChatContext";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
import { MemberList } from "./MemberList";

export const ChatBox = ({ conversation }: { conversation: Conversation }) => {
  const conversationIdRef = useRef(conversation.conversationId);
  const [showMembers, setShowMembers] = useState(false);

  useEffect(() => {
    conversationIdRef.current = conversation.conversationId;
  }, [conversation.conversationId]);

  const handleSearchMessages = (_query: string) => {
    // TODO: implement search
  };

  return (
    <ChatProvider conversationId={conversation.conversationId}>
      <div className="flex h-full">
        <div className="flex flex-col flex-1 bg-card text-card-foreground">
          <ChatHeader
            conversation={conversation}
            onShowSettings={() => { }}
            onShowMembers={() => setShowMembers(true)}
            onShowPinnedMessages={() => { }}
            onSearchMessages={handleSearchMessages}
          />

          <div className="flex-1 overflow-y-auto bg-background p-4">
            <MessageList conversationId={conversation.conversationId} />
          </div>

          <TypingIndicator conversationId={conversation.conversationId} />

          <div className="p-4 bg-card border-t border-border">
            <MessageInput />
          </div>
        </div>

        {showMembers && conversation.type === 'group' && (
          <MemberList
            conversationId={conversation.conversationId}
            onClose={() => setShowMembers(false)}
          />
        )}
      </div>
    </ChatProvider>
  );
};