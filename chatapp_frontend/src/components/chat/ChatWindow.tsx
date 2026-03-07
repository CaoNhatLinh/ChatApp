
import { useConversationStore } from '@/store/conversationStore';
import { ChatBox } from './ChatBox';

export const ChatWindow = () => {
  const { selectedConversation } = useConversationStore();

  if (!selectedConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Welcome to ChatApp
        </h2>
        <p className="text-muted-foreground max-w-xs">
          Select a conversation from the sidebar to start chatting.
        </p>
      </div>
    );
  }

  return (
    <ChatBox conversation={selectedConversation} />
  );
};