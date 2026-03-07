// Simplified ChatContext using useChatWebSocket
import React, { createContext, useContext, useCallback, useEffect, useRef, useMemo } from 'react';
import { useChatWebSocket } from '@/hooks/chat';
import { useConversationStore } from '@/store/conversationStore';
import type { MessageResponseDto, SendMessageWsPayload } from '@/types/message.js';
import type { TypingEventReceived } from '@/types/websocket';

interface ChatContextType {
  sendMessage: (payload: SendMessageWsPayload) => void;
  isConnected: boolean;
  conversationId: string;
  sendTyping: (isTyping: boolean) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode; conversationId: string }> = ({
  children,
  conversationId
}) => {
  const { updateTypingUsers, getTypingUsersForConversation, addMessage } = useConversationStore();

  const onMessageReceived = useCallback((message: MessageResponseDto) => {
    addMessage(message);
  }, [addMessage]);

  const onTypingReceived = useCallback((event: TypingEventReceived) => {
    if (event.user && event.user.userId !== 'null' && event.user.userId !== '') {
      updateTypingUsers(event.conversationId, event.user.userId, event.isTyping, event.user);
    } else if (!event.isTyping) {
      const currentTypingUsers = getTypingUsersForConversation(event.conversationId);
      currentTypingUsers?.forEach((typingUser) => {
        updateTypingUsers(event.conversationId, typingUser.userId, false);
      });
    }
  }, [updateTypingUsers, getTypingUsersForConversation]);

  const chatWebSocket = useChatWebSocket({
    onMessageReceived,
    onTypingReceived,
    
  });

  const sendMessage = useCallback((payload: SendMessageWsPayload) => {
    chatWebSocket.sendMessage(payload);
  }, [chatWebSocket]);
  
  const sendTyping = useCallback((isTyping: boolean) => {
    chatWebSocket.sendTyping(conversationId, isTyping);
  }, [conversationId, chatWebSocket]);

  // Subscribe to conversation on mount or when conversationId changes
  useEffect(() => {
    if (!conversationId) return;
    
    if (chatWebSocket.isConnected()) {
      chatWebSocket.subscribeToConversation(conversationId);
    }
    
    // Unsubscribe on cleanup
    return () => {
      chatWebSocket.unsubscribeFromConversation(conversationId);
    };
  }, [conversationId, chatWebSocket]);
  
  // Handle reconnection
  const connectionReestablished = useRef(false);
  useEffect(() => {
    const isConnected = chatWebSocket.isConnected();
    
    if (!isConnected) {
      connectionReestablished.current = true;
    } else if (isConnected && connectionReestablished.current && conversationId) {
      chatWebSocket.subscribeToConversation(conversationId);
      connectionReestablished.current = false;
    }
  }, [chatWebSocket, conversationId]);

  const value: ChatContextType = useMemo(() => ({
    sendMessage,
    isConnected: chatWebSocket.isConnected(),
    conversationId,
    sendTyping,
  }), [sendMessage, chatWebSocket, conversationId, sendTyping]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
// eslint-disable-next-line react-refresh/only-export-components
export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};
