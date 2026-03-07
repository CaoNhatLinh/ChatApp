import { create } from "zustand";
import type { Conversation, ConversationRequest } from "@/types/conversation";
import type { MessageResponseDto } from "@/types/message";
import type { UserDTO } from "@/types/user";
import { createConversation, fetchMyConversations, findDmConversation } from "@/api//conversationApi";
import { logger } from "@/utils/logger";

interface TypingUser {
  userId: string;
  user?: UserDTO;
}

interface ConversationStore {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  fetchConversations: () => Promise<void>;
  selectedConversation: Conversation | null;
  findDmConversation: (userId1: string, userId2: string) => Promise<Conversation>;
  setSelectedConversation: (conversation: Conversation | null) => void;
  createConversation: (conversation: Conversation) => Promise<void>;
  clear: () => void;

  // WebSocket related state and methods
  messages: Map<string, MessageResponseDto[]>; // conversationId -> messages (bounded)
  typingUsers: Map<string, Map<string, TypingUser>>; // conversationId -> Map<userId, TypingUser>

  addMessage: (message: MessageResponseDto) => void;
  updateTypingUsers: (conversationId: string, userId: string, isTyping: boolean, user?: UserDTO) => void;
  getConversationMessages: (conversationId: string) => MessageResponseDto[];
  getTypingUsersForConversation: (conversationId: string) => TypingUser[];
  clearConversationMessages: (conversationId: string) => void;
}



export const useConversationStore = create<ConversationStore>((set) => ({
  conversations: [],
  loading: false,
  error: null,
  selectedConversation: null,

  fetchConversations: async () => {
    set({ loading: true, error: null });
    try {
      const conversations = await fetchMyConversations();
      set({ conversations, loading: false });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to fetch conversations";
      logger.error("Error fetching conversations:", errorMsg);
      set({ loading: false, error: errorMsg });
    }
  },
  createConversation: async (request: ConversationRequest) => {
    set({ loading: true, error: null });
    try {
      const conversation = await createConversation(request);
      set((state) => ({
        conversations: [...state.conversations, conversation],
        loading: false,
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to create conversation";
      set({ loading: false, error: errorMsg });
    }
  },
  findDmConversation: async (userId1: string, userId2: string) => {
    set({ loading: true, error: null });
    try {
      logger.debug("Finding DM conversation between users");
      const conversation = await findDmConversation(userId1, userId2);
      logger.debug("Found DM conversation");
      set({ loading: false });
      return conversation;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to find DM conversation";
      set({ loading: false, error: errorMsg });
      throw error;
    }
  },
  setSelectedConversation: (conversation) => {
    logger.debug('[ConversationStore] Setting selected conversation');
    set({ selectedConversation: conversation });
  },
  clear: () => set({ conversations: [], selectedConversation: null }),

  // WebSocket state initialization
  messages: new Map(),
  typingUsers: new Map(),

  // WebSocket methods
  addMessage: (message) => set((state) => {
    const conversationMessages = state.messages.get(message.conversationId) || [];

    // Check for duplicates
    const isDuplicate = conversationMessages.some(m => m.messageId === message.messageId);
    if (isDuplicate) {
      logger.debug('[ConversationStore] Duplicate message detected, skipping:', message.messageId);
      return state;
    }

    logger.debug('[ConversationStore] Adding new message:', message.messageId);
    const newMessages = new Map(state.messages);
    const updatedMessages = [...conversationMessages, message];
    
    // F-08: Bound message cache to prevent unbounded memory growth
    const MAX_CACHED_MESSAGES = 200;
    if (updatedMessages.length > MAX_CACHED_MESSAGES) {
      newMessages.set(message.conversationId, updatedMessages.slice(-MAX_CACHED_MESSAGES));
    } else {
      newMessages.set(message.conversationId, updatedMessages);
    }
    return { messages: newMessages };
  }),

  updateTypingUsers: (conversationId, userId, isTyping, user) => set((state) => {
    const newTypingUsers = new Map(state.typingUsers);
    const currentTyping = newTypingUsers.get(conversationId) || new Map<string, TypingUser>();

    if (isTyping) {
      currentTyping.set(userId, { userId, user });
    } else {
      currentTyping.delete(userId);
      // F-20: Clean up empty typing maps
      if (currentTyping.size === 0) {
        newTypingUsers.delete(conversationId);
        return { typingUsers: newTypingUsers };
      }
    }

    newTypingUsers.set(conversationId, currentTyping);
    return { typingUsers: newTypingUsers };
  }),

  getConversationMessages: (conversationId: string): MessageResponseDto[] => {
    return useConversationStore.getState().messages.get(conversationId) || [];
  },

  getTypingUsersForConversation: (conversationId: string): TypingUser[] => {
    const typingMap = useConversationStore.getState().typingUsers.get(conversationId);
    return typingMap ? Array.from(typingMap.values()) : [];
  },

  // F-08: Allow clearing messages for a specific conversation to free memory
  clearConversationMessages: (conversationId: string) => set((state) => {
    const newMessages = new Map(state.messages);
    newMessages.delete(conversationId);
    
    // F-20: Also clear typing users for that conversation
    const newTypingUsers = new Map(state.typingUsers);
    newTypingUsers.delete(conversationId);
    
    return { messages: newMessages, typingUsers: newTypingUsers };
  }),
}));
