// src/components/chat/MessageList.tsx
// Refactored: extracted useMessageActions, useScrollManager, DateSeparator

import React, { useEffect, useCallback } from 'react';
import { useMessages } from '@/hooks/chat';
import { useConversationStore } from '@/store/conversationStore';
import { useAuthStore } from '@/store/authStore';
import { MessageBubble } from './MessageBubble';
import { DateSeparator, TimeSeparator } from './DateSeparator';
import { useMessageActions } from '@/hooks/chat/useMessageActions';
import { useScrollManager } from '@/hooks/chat/useScrollManager';
import type { MessageResponseDto } from '@/types/message';
import type { Conversation } from '@/types/conversation';

interface MessageListProps {
  className?: string;
  onReply?: (message: MessageResponseDto) => void;
  conversationId?: string;
  conversation?: Conversation;
}

// Group messages by date string
function groupMessagesByDate(messages: MessageResponseDto[]): Record<string, MessageResponseDto[]> {
  const groups: Record<string, MessageResponseDto[]> = {};
  messages.forEach((message) => {
    const date = new Date(message.createdAt).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
  });
  return groups;
}

export const MessageList: React.FC<MessageListProps> = ({
  className = '',
  onReply,
  conversationId: propConversationId,
  conversation: propConversation,
}) => {
  const { selectedConversation, getConversationMessages } = useConversationStore();
  const { user } = useAuthStore();

  const conversation = propConversation || selectedConversation;
  const conversationId = propConversationId || conversation?.conversationId || '';

  const {
    messages: storedMessages,
    loading,
    hasMore,
    error,
    fetchMessages,
    loadMoreMessages,
  } = useMessages({ conversationId });

  const realtimeMessages = getConversationMessages(conversationId);

  // Merge stored + realtime messages, deduplicate by messageId
  const allMessages = React.useMemo(() => {
    const messagesMap = new Map<string, MessageResponseDto>();
    storedMessages.forEach((msg) => messagesMap.set(msg.messageId, msg));
    realtimeMessages.forEach((msg) => messagesMap.set(msg.messageId, msg));
    return Array.from(messagesMap.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [storedMessages, realtimeMessages]);

  // Scroll management
  const {
    messagesEndRef,
    messagesContainerRef,
    isLoadingOlder,
    setIsLoadingOlder,
    isInitialLoadComplete,
    setIsInitialLoadComplete,
    userHasScrolled,
    setUserHasScrolled,
    scrollToBottom,
  } = useScrollManager({
    messageCount: allMessages.length,
    isLoadingOlder: false,
    isLoading: loading,
    isInitialLoadComplete: false,
  });

  // Message actions
  const { handleReply, handleReact, handleEdit, handleDelete } = useMessageActions({
    conversationId,
    allMessages,
    fetchMessages,
    onReply,
  });

  // Fetch on conversation change
  useEffect(() => {
    setIsInitialLoadComplete(false);
    setUserHasScrolled(false);
    if (conversationId) {
      void fetchMessages();
    }
  }, [conversationId, fetchMessages, setIsInitialLoadComplete, setUserHasScrolled]);

  // Initial scroll to bottom after first load
  useEffect(() => {
    if (!loading && storedMessages.length > 0 && !isInitialLoadComplete) {
      setIsInitialLoadComplete(true);
      setTimeout(() => scrollToBottom(false), 0);
    }
  }, [loading, storedMessages.length, isInitialLoadComplete, setIsInitialLoadComplete, scrollToBottom]);

  // Infinite scroll handler
  const handleScroll = useCallback(async () => {
    const container = messagesContainerRef.current;
    if (!container || !hasMore || isLoadingOlder || loading || !isInitialLoadComplete) return;

    if (!userHasScrolled) {
      setUserHasScrolled(true);
    }

    if (storedMessages.length > 0 && container.scrollTop < 100 && userHasScrolled) {
      setIsLoadingOlder(true);
      try {
        const scrollPositionBefore = container.scrollTop;
        const scrollHeightBefore = container.scrollHeight;

        await loadMoreMessages();

        setTimeout(() => {
          requestAnimationFrame(() => {
            const scrollHeightAfter = container.scrollHeight;
            const heightAdded = scrollHeightAfter - scrollHeightBefore;
            if (heightAdded > 0) {
              container.scrollTop = scrollPositionBefore + heightAdded;
            }
          });
        }, 0);
      } catch (err) {
        console.error('Failed to load older messages:', err instanceof Error ? err.message : err);
      } finally {
        setIsLoadingOlder(false);
      }
    }
  }, [hasMore, isLoadingOlder, loading, isInitialLoadComplete, userHasScrolled, storedMessages.length, loadMoreMessages, messagesContainerRef, setUserHasScrolled, setIsLoadingOlder]);

  // --- Render states ---

  if (!conversationId) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">No conversation selected</p>
          <p className="text-sm">Choose a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  if (loading && allMessages.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="w-8 h-8 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center text-red-600 dark:text-red-400">
          <p className="text-lg mb-2">Error loading messages</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={() => void fetchMessages()}
            className="mt-2 px-4 py-2 bg-blue-600 text-white dark:bg-blue-400 dark:text-gray-900 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-300 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(allMessages);
  const dates = Object.keys(messageGroups).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <div
      ref={messagesContainerRef}
      className={`flex-1 overflow-y-auto p-4 space-y-4 ${className}`}
      onScroll={() => void handleScroll()}
    >
      {isLoadingOlder && (
        <div className="flex justify-center py-4">
          <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
            <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
            <span className="text-sm">Loading older messages...</span>
          </div>
        </div>
      )}

      {dates.map((date) => (
        <div key={date}>
          <DateSeparator dateString={date} />
          <div className="space-y-3">
            {messageGroups[date].map((message, index) => {
              const previousMessage = index > 0 ? messageGroups[date][index - 1] : null;
              const nextMessage =
                index < messageGroups[date].length - 1 ? messageGroups[date][index + 1] : null;

              const timeDiffWithPrev = previousMessage
                ? new Date(message.createdAt).getTime() - new Date(previousMessage.createdAt).getTime()
                : 0;

              const isPrevFromSameUser = previousMessage?.sender?.userId === message.sender?.userId;
              const shouldGroupWithPrev = isPrevFromSameUser && timeDiffWithPrev < 5 * 60 * 1000;
              const isTimeGap = timeDiffWithPrev > 60 * 60 * 1000;

              const isNextFromSameUser = nextMessage?.sender?.userId === message.sender?.userId;
              const timeDiffWithNext = nextMessage
                ? new Date(nextMessage.createdAt).getTime() - new Date(message.createdAt).getTime()
                : 0;
              const shouldGroupWithNext = isNextFromSameUser && timeDiffWithNext < 5 * 60 * 1000;

              const showName = !shouldGroupWithPrev;
              const showAvatar = !shouldGroupWithNext;

              const senderId = message.sender?.userId;
              if (!senderId) return null;

              return (
                <React.Fragment key={message.messageId}>
                  {isTimeGap && <TimeSeparator timestamp={message.createdAt} />}
                  <MessageBubble
                    message={message}
                    isOwn={senderId === user?.userId}
                    showAvatar={showAvatar}
                    showName={showName}
                    onReply={() => handleReply(message)}
                    onReact={(emoji: string) => { void handleReact(message.messageId, emoji); }}
                    onEdit={() => handleEdit(message.messageId)}
                    onDelete={() => { void handleDelete(message.messageId); }}
                  />
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ))}

      {allMessages.length === 0 && !loading && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">No messages yet</p>
            <p className="text-sm">Be the first to send a message!</p>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
