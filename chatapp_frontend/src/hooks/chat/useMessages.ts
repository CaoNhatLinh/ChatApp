// src/hooks/useMessages.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/common/lib/logger';
import { getLatestMessages, getOlderMessages } from '@/api/messageApi';
import type { MessageResponseDto } from '@/types/message';

interface UseMessagesOptions {
  conversationId?: string;
  limit?: number;
  autoRefresh?: boolean;
}

export const useMessages = (options: UseMessagesOptions = {}) => {
  const { conversationId, limit = 20, autoRefresh = false } = options;

  const [messages, setMessages] = useState<MessageResponseDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchMessages = useCallback(async (beforeMessageId?: string) => {
    if (!conversationId) {
      logger.debug('[useMessages] No conversationId provided');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('No authentication token found');
      logger.error('[useMessages] No token found');
      return;
    }

    logger.debug('[useMessages] Fetching messages for conversation:', conversationId, {
      requestType: beforeMessageId ? 'LOAD_MORE (older)' : 'INITIAL_LOAD (latest)'
    });
    setLoading(true);
    setError(null);

    try {
      let response: MessageResponseDto[];

      if (beforeMessageId) {
        // Load older messages (30 messages)
        logger.debug('[useMessages] Loading older messages before:', beforeMessageId);
        response = await getOlderMessages(token, conversationId, beforeMessageId);
      } else {
        // Initial load (20 messages)
        logger.debug('[useMessages] Loading latest messages with limit:', limit);
        response = await getLatestMessages(token, conversationId, limit);
      }

      logger.debug('[useMessages] Received messages count:', response.length);

      if (beforeMessageId) {
        // Load more messages (append to beginning, but check for duplicates)
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.messageId));
          const newMessages = response.filter(m => !existingIds.has(m.messageId));
          logger.debug(`[useMessages] Adding ${newMessages.length} new older messages (filtered ${response.length - newMessages.length} duplicates)`);
          return [...newMessages, ...prev];
        });
        setHasMore(response.length === 30); // For older messages, we load 30 at a time
      } else {
        // Initial load or refresh (replace all messages)
        setMessages(response);
        setHasMore(response.length === limit);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch messages';
      logger.error('Failed to fetch messages:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [conversationId, limit]);

  // F-09: Guard against double-request on rapid loadMore calls
  const loadingMoreRef = useRef(false);

  const loadMoreMessages = useCallback(async () => {
    if (messages.length > 0 && hasMore && !loading && !loadingMoreRef.current) {
      loadingMoreRef.current = true;
      try {
        const oldestMessage = messages[0];
        logger.debug('[useMessages] Loading more messages before messageId:', oldestMessage.messageId);
        await fetchMessages(oldestMessage.messageId);
      } finally {
        loadingMoreRef.current = false;
      }
    } else {
      logger.debug('[useMessages] Cannot load more:', {
        hasMessages: messages.length > 0,
        hasMore,
        loading
      });
    }
  }, [messages, hasMore, loading, fetchMessages]);

  const addMessage = useCallback((message: MessageResponseDto) => {
    logger.debug('[useMessages] addMessage called with:', message.messageId);
    setMessages(prev => {
      // Check for duplicates
      const isDuplicate = prev.some(m => m.messageId === message.messageId);
      if (isDuplicate) {
        logger.warn('[useMessages] Duplicate message detected, skipping:', message.messageId);
        return prev;
      }

      return [...prev, message];
    });
  }, []);

  const updateMessage = useCallback((messageId: string, updates: Partial<MessageResponseDto>) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.messageId === messageId ? { ...msg, ...updates } : msg
      )
    );
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.messageId !== messageId));
  }, []);

  // Initial fetch when conversationId changes
  useEffect(() => {
    // F-01: Use stale flag to prevent race condition when conversation switches rapidly
    let stale = false;

    if (conversationId) {
      logger.debug('[useMessages] Clearing previous messages and loading initial messages for:', conversationId);
      setMessages([]);
      setError(null);
      setHasMore(true);

      const loadInitial = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          if (!stale) setError('No authentication token found');
          return;
        }
        if (!stale) setLoading(true);
        try {
          const response = await getLatestMessages(token, conversationId, limit);
          if (!stale) {
            setMessages(response);
            setHasMore(response.length === limit);
          }
        } catch (err) {
          if (!stale) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch messages';
            setError(errorMessage);
          }
        } finally {
          if (!stale) setLoading(false);
        }
      };
      void loadInitial();
    } else {
      logger.debug('[useMessages] No conversationId, clearing messages');
      setMessages([]);
      setError(null);
      setHasMore(true);
    }

    return () => { stale = true; };
  }, [conversationId, limit]);

  // Auto refresh if enabled
  useEffect(() => {
    if (!autoRefresh || !conversationId) return;

    const interval = setInterval(() => {
      void fetchMessages();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, conversationId, fetchMessages]);

  return {
    messages,
    loading,
    error,
    hasMore,
    fetchMessages,
    loadMoreMessages,
    addMessage,
    updateMessage,
    removeMessage,
    refresh: () => fetchMessages(),
  };
};
