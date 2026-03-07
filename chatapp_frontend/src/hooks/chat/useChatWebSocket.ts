// src/hooks/useChatWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import { logger } from '@/common/lib/logger';
import { chatWebSocketService } from '@/services/chatWebSocketService';
import type {
  TypingEventReceived,
  NotificationReceived,
} from '@/types/websocket';
import type { MessageResponseDto } from '@/types/message';

interface UseChatWebSocketOptions {
  onMessageReceived?: (message: MessageResponseDto) => void;
  onTypingReceived?: (event: TypingEventReceived) => void;
  onNotificationReceived?: (event: NotificationReceived) => void;
}

export const useChatWebSocket = (options: UseChatWebSocketOptions = {}) => {
  const {
    onMessageReceived,
    onTypingReceived,
    onNotificationReceived,
  } = options;



  const subscribedConversations = useRef<Set<string>>(new Set());

  // F-02: Use refs for message/typing callbacks to prevent stale closures
  // when conversation is already subscribed but callback changes
  const onMessageReceivedRef = useRef(onMessageReceived);
  const onTypingReceivedRef = useRef(onTypingReceived);

  useEffect(() => {
    onMessageReceivedRef.current = onMessageReceived;
  }, [onMessageReceived]);

  useEffect(() => {
    onTypingReceivedRef.current = onTypingReceived;
  }, [onTypingReceived]);

  // Message operations
  const sendMessage = useCallback((payload: Parameters<typeof chatWebSocketService.sendMessage>[0]) => {
    chatWebSocketService.sendMessage(payload);
  }, []);

  const subscribeToConversation = useCallback((conversationId: string) => {
    if (subscribedConversations.current.has(conversationId)) {
      return; // Already subscribed
    }


    chatWebSocketService.subscribeToMessages(conversationId, (message) => {
      logger.debug('[WebSocket] Message details:', { message });
      onMessageReceivedRef.current?.(message);
    });

    // Subscribe to typing events for this conversation
    chatWebSocketService.subscribeToTyping(conversationId, (event) => {
      onTypingReceivedRef.current?.(event);
    });

    subscribedConversations.current.add(conversationId);
  }, []);

  const unsubscribeFromConversation = useCallback((conversationId: string) => {
    if (!subscribedConversations.current.has(conversationId)) {
      return; // Not subscribed
    }

    chatWebSocketService.unsubscribeFromMessages(conversationId);
    chatWebSocketService.unsubscribeFromTyping(conversationId);
    subscribedConversations.current.delete(conversationId);
  }, []);

  // Typing operations
  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    chatWebSocketService.sendTyping(conversationId, isTyping);
  }, []);

  // Notification operations
  const markNotificationAsRead = useCallback((notificationId: string) => {
    chatWebSocketService.markNotificationAsRead(notificationId);
  }, []);

  // Utility methods
  const isConnected = useCallback(() => {
    return chatWebSocketService.isConnected();
  }, []);

  const getActiveSubscriptions = useCallback(() => {
    return chatWebSocketService.getActiveSubscriptions();
  }, []);

  // Track subscription states to prevent duplicates
  const subscriptionStates = useRef({
    notifications: false
  });

  // Stable callback refs to prevent re-subscriptions
  const notificationCallbackRef = useRef(onNotificationReceived);

  // Update callback refs when props change
  useEffect(() => {
    notificationCallbackRef.current = onNotificationReceived;
  }, [onNotificationReceived]);

  // Setup global subscriptions - only once per hook instance
  useEffect(() => {
    let isSetupComplete = false;

    // Capture refs to use in cleanup per exhaustive-deps rule
    const currentSubscribedConversations = subscribedConversations;
    const currentSubscriptionStates = subscriptionStates;

    const setupSubscriptions = () => {
      // Only setup subscriptions if connected and not already set up
      if (!isConnected() || isSetupComplete) return;

      // Note: Online status & presence subscriptions are now handled by presenceWsService directly

      if (notificationCallbackRef.current && !currentSubscriptionStates.current.notifications) {
        chatWebSocketService.subscribeToNotifications((event) => {
          notificationCallbackRef.current?.(event);
        });
        currentSubscriptionStates.current.notifications = true;
      }

      isSetupComplete = true;
    };

    // Initial setup
    setupSubscriptions();

    // Cleanup on unmount only
    return () => {

      // Unsubscribe from all conversations
      const conversationsToUnsubscribe = Array.from(currentSubscribedConversations.current);
      conversationsToUnsubscribe.forEach((conversationId) => {
        chatWebSocketService.unsubscribeFromMessages(conversationId);
        chatWebSocketService.unsubscribeFromTyping(conversationId);
      });
      currentSubscribedConversations.current.clear();

      // Unsubscribe from global events and reset states
      const states = currentSubscriptionStates.current;

      if (states.notifications) {
        chatWebSocketService.unsubscribeFromNotifications();
        states.notifications = false;
      }
    };
  }, [isConnected]); // Added isConnected - chạy một lần khi isConnected thay đổi

  return {
    // Message operations
    sendMessage,
    subscribeToConversation,
    unsubscribeFromConversation,

    // Typing operations
    sendTyping,

    // Notification operations
    markNotificationAsRead,

    // Utility methods
    isConnected,
    getActiveSubscriptions,

    // State
    subscribedConversations: Array.from(subscribedConversations.current),
  };
};

// Specialized hooks for specific features
export const useMessageWebSocket = (
  conversationId: string,
  onMessageReceived: (message: MessageResponseDto) => void,
  onEchoReceived?: (echo: MessageResponseDto) => void
) => {
  logger.debug('[useMessageWebSocket] Hook initialized with:', {
    conversationId,
    hasOnMessageReceived: !!onMessageReceived,
    hasOnEchoReceived: !!onEchoReceived
  });

  const chatWebSocket = useChatWebSocket({
    onMessageReceived: (message) => {
      onMessageReceived(message);
    },
  });

  const { subscribeToConversation, unsubscribeFromConversation, isConnected } = chatWebSocket;

  useEffect(() => {
    logger.debug('[useMessageWebSocket] Effect triggered:', {
      conversationId,
      isConnected: isConnected(),
      hasCallbacks: !!onMessageReceived
    });

    if (conversationId && isConnected()) {
      subscribeToConversation(conversationId);

      // Subscribe to message echo for immediate feedback
      if (onEchoReceived) {
        chatWebSocketService.subscribeToMessageEcho((echo) => {
          onEchoReceived(echo);
        });
      }

      return () => {
        unsubscribeFromConversation(conversationId);
        if (onEchoReceived) {
          chatWebSocketService.unsubscribeFromMessageEcho();
        }
      };
    } else {
      logger.debug('[useMessageWebSocket] Not subscribing:', {
        hasConversationId: !!conversationId,
        isConnected: isConnected()
      });
    }
  }, [conversationId, subscribeToConversation, unsubscribeFromConversation, onEchoReceived, isConnected, onMessageReceived]);


};


