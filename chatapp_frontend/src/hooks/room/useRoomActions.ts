// src/hooks/room/useRoomActions.ts
import { useState, useCallback } from 'react';
import { logger } from '@/common/lib/logger';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/utils/errorHandler';
import type {
  RoomMember,
  RoomActionType,
  RoomSettings,
  PinnedMessage,
  UserProfileModal as UserProfile
} from '@/types/roomActions';
import type { Conversation } from '@/types/conversation';

// Mock API calls - replace with actual API implementation
const roomApi = {
  getMembers: (_conversationId: string): Promise<RoomMember[]> => {
    return Promise.resolve([
      {
        userId: 'user1',
        username: 'admin_user',
        displayName: 'Admin User',
        role: 'admin',
        joinedAt: '2024-01-01T00:00:00Z',
        isOnline: true
      },
      {
        userId: 'user2',
        username: 'mod_user',
        displayName: 'Moderator User',
        role: 'moderator',
        joinedAt: '2024-01-02T00:00:00Z',
        isOnline: false
      }
    ]);
  },

  updateRoomSettings: (conversationId: string, settings: Partial<RoomSettings>): Promise<void> => {
    logger.debug('Updating room settings:', { conversationId, settings });
    return Promise.resolve();
  },

  performMemberAction: (conversationId: string, memberId: string, action: RoomActionType, reason?: string): Promise<void> => {
    logger.debug('Performing member action:', { conversationId, memberId, action, reason });
    return Promise.resolve();
  },

  getPinnedMessages: (_conversationId: string): Promise<PinnedMessage[]> => {
    return Promise.resolve([]);
  },

  pinMessage: (messageId: string): Promise<void> => {
    logger.debug('Pinning message:', messageId);
    return Promise.resolve();
  },

  unpinMessage: (messageId: string): Promise<void> => {
    logger.debug('Unpinning message:', messageId);
    return Promise.resolve();
  },

  getUserProfile: (userId: string): Promise<UserProfile> => {
    return Promise.resolve({
      userId,
      username: 'user',
      displayName: 'User Name',
      joinedAt: '2024-01-01T00:00:00Z',
      isOnline: true
    });
  }
};

export const useRoomActions = (conversation: Conversation) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [loadingPinned, setLoadingPinned] = useState(false);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const currentUserMember = members.find(m => m.userId === user?.userId);
  const currentUserRole = currentUserMember?.role || 'member';

  const loadMembers = useCallback(async () => {
    if (!conversation.conversationId) return;
    setLoadingMembers(true);
    try {
      const roomMembers = await roomApi.getMembers(conversation.conversationId);
      setMembers(roomMembers);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoadingMembers(false);
    }
  }, [conversation.conversationId]);

  const loadPinnedMessages = useCallback(async () => {
    if (!conversation.conversationId) return;
    setLoadingPinned(true);
    try {
      const pinned = await roomApi.getPinnedMessages(conversation.conversationId);
      setPinnedMessages(pinned);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoadingPinned(false);
    }
  }, [conversation.conversationId]);

  const loadUserProfile = useCallback(async (userId: string) => {
    setLoadingProfile(true);
    try {
      const profile = await roomApi.getUserProfile(userId);
      setUserProfile(profile);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const updateRoomSettings = useCallback(async (settings: Partial<RoomSettings>) => {
    if (!conversation.conversationId) return;
    setLoading(true);
    try {
      await roomApi.updateRoomSettings(conversation.conversationId, settings);
    } catch (error) {
      setError(getErrorMessage(error));
      throw error;
    } finally {
      setLoading(false);
    }
  }, [conversation.conversationId]);

  const performMemberAction = useCallback(async (memberId: string, action: RoomActionType, reason?: string) => {
    if (!conversation.conversationId) return;
    setLoading(true);
    try {
      await roomApi.performMemberAction(conversation.conversationId, memberId, action, reason);
      if (action === 'KICK_MEMBER' || action === 'BAN_MEMBER') {
        setMembers(prev => prev.filter(m => m.userId !== memberId));
      } else if (action === 'PROMOTE_TO_ADMIN') {
        setMembers(prev => prev.map(m =>
          m.userId === memberId ? { ...m, role: 'admin' as const } : m
        ));
      } else if (action === 'PROMOTE_TO_MODERATOR') {
        setMembers(prev => prev.map(m =>
          m.userId === memberId ? { ...m, role: 'moderator' as const } : m
        ));
      } else if (action === 'DEMOTE_FROM_ADMIN' || action === 'DEMOTE_FROM_MODERATOR') {
        setMembers(prev => prev.map(m =>
          m.userId === memberId ? { ...m, role: 'member' as const } : m
        ));
      }
    } catch (error) {
      setError(getErrorMessage(error));
      throw error;
    } finally {
      setLoading(false);
    }
  }, [conversation.conversationId]);

  const pinMessage = useCallback(async (messageId: string) => {
    setLoading(true);
    try {
      await roomApi.pinMessage(messageId);
      await loadPinnedMessages();
    } catch (error) {
      setError(getErrorMessage(error));
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadPinnedMessages]);

  const unpinMessage = useCallback(async (messageId: string) => {
    setLoading(true);
    try {
      await roomApi.unpinMessage(messageId);
      setPinnedMessages(prev => prev.filter(p => p.messageId !== messageId));
    } catch (error) {
      setError(getErrorMessage(error));
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const goToMessage = useCallback((messageId: string) => {
    logger.debug('Navigating to message:', messageId);
  }, []);

  const leaveRoom = useCallback(async () => {
    if (!conversation.conversationId || !user) return;
    setLoading(true);
    try {
      await roomApi.performMemberAction(conversation.conversationId, user.userId, 'KICK_MEMBER');
    } catch (error) {
      setError(getErrorMessage(error));
      throw error;
    } finally {
      setLoading(false);
    }
  }, [conversation.conversationId, user]);

  const dissolveRoom = useCallback(async () => {
    if (!conversation.conversationId) return;
    setLoading(true);
    try {
      await roomApi.performMemberAction(conversation.conversationId, '', 'DISSOLVE_ROOM');
    } catch (error) {
      setError(getErrorMessage(error));
      throw error;
    } finally {
      setLoading(false);
    }
  }, [conversation.conversationId]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    members,
    pinnedMessages,
    userProfile,
    currentUserRole,
    loading,
    loadingMembers,
    loadingPinned,
    loadingProfile,
    error,

    loadMembers,
    loadPinnedMessages,
    loadUserProfile,
    updateRoomSettings,
    performMemberAction,
    pinMessage,
    unpinMessage,
    goToMessage,
    leaveRoom,
    dissolveRoom,
    clearError,

    isAdmin: currentUserRole === 'admin',
    isModerator: currentUserRole === 'moderator',
    canManageRoom: currentUserRole === 'admin' || currentUserRole === 'moderator'
  };
};
