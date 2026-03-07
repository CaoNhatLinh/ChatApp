// src/components/room/RoomManager.tsx

import React, { useState, useEffect } from 'react';
import { RoomSettingsModal } from './RoomSettingsModal';
import { PinnedMessagesModal } from './PinnedMessagesModal';
import { RoomMenuButton, RoleIndicator } from './RoomMenuButton';
import { UserProfileModal } from '../user/UserProfileModal';
import { useRoomActions } from '../../hooks/room/useRoomActions';
import type { Conversation, ConversationRequest } from '@/types/conversation';
import { useMessenger } from '@/features/messenger/hooks/useMessenger';
import { findDmConversation, createConversation } from '@/api/conversationApi';
import { useAuthStore } from '@/store/authStore';

interface RoomManagerProps {
  conversation: Conversation;
  children?: React.ReactNode;
}

export const RoomManager: React.FC<RoomManagerProps> = ({ conversation, children }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUserId] = useState<string>('');

  const { selectConversation, setActiveView, hoistConversation } = useMessenger();
  const { user } = useAuthStore();

  const handleOpenChatFromProfile = async (targetUserId: string) => {
    if (!user?.userId) return;
    try {
      let dmConversation;
      try {
        dmConversation = await findDmConversation(user.userId, targetUserId);
      } catch {
        dmConversation = await createConversation({
          type: 'dm',
          memberIds: [targetUserId]
        } as unknown as ConversationRequest);
      }

      // @ts-expect-error Different conversation types across modules
      hoistConversation(dmConversation);
      await selectConversation(dmConversation.conversationId);
      setActiveView('chat');
      setShowUserProfile(false);
    } catch (error) {
      console.error('Không thể mở cuộc trò chuyện:', error);
    }
  };

  const {
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
    updateRoomSettings,
    unpinMessage,
    goToMessage,
    leaveRoom,
    dissolveRoom,
    clearError,
    isAdmin,
    isModerator
  } = useRoomActions(conversation);

  // Load initial data when conversation changes
  useEffect(() => {
    if (conversation.conversationId && conversation.type === 'group') {
      void loadMembers();
      void loadPinnedMessages();
    }
  }, [conversation.conversationId, conversation.type, loadMembers, loadPinnedMessages]);
  const handleShowMembers = (): void => {
    if (!loadingMembers && members.length === 0) {
      void loadMembers();
    }
  };

  const handleShowPinnedMessages = (): void => {
    if (!loadingPinned && pinnedMessages.length === 0) {
      void loadPinnedMessages();
    }
    setShowPinnedMessages(true);
  };

  const handleDissolveRoom = (): void => {
    const confirmed = window.confirm(
      'Are you sure you want to dissolve this room? This action cannot be undone and all members will be removed.'
    );
    if (confirmed) {
      void dissolveRoom();
    }
  };

  const handleLeaveRoom = (): void => {
    const confirmed = window.confirm(
      `Are you sure you want to leave this ${conversation.type === 'group' ? 'room' : 'conversation'}?`
    );
    if (confirmed) {
      void leaveRoom();
    }
  };

  useEffect(() => {
    if (error) {
      console.error('Room action error:', error);
      setTimeout(clearError, 5000);
    }
  }, [error, clearError]);

  return (
    <>
      {children}
      {conversation.type === 'group' && (
        <div className="room-menu-container">
          <RoomMenuButton
            conversation={conversation}
            memberRole={currentUserRole}
            onShowSettings={() => setShowSettings(true)}
            onShowMembers={handleShowMembers}
            onShowPinnedMessages={handleShowPinnedMessages}
            onLeaveRoom={handleLeaveRoom}
            onDissolveRoom={isAdmin ? handleDissolveRoom : undefined}
          />

          {/* Role indicator for current user */}
          {(isAdmin || isModerator) && (
            <RoleIndicator role={currentUserRole} />
          )}
        </div>
      )}

      <RoomSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        conversation={conversation}
        onSave={updateRoomSettings}
      />
      <PinnedMessagesModal
        isOpen={showPinnedMessages}
        onClose={() => setShowPinnedMessages(false)}
        pinnedMessages={pinnedMessages}
        onUnpinMessage={unpinMessage}
        onGoToMessage={goToMessage}
      />
      <UserProfileModal
        isOpen={showUserProfile}
        onClose={() => setShowUserProfile(false)}
        userId={selectedUserId}
        userProfile={userProfile || undefined}
        isLoading={loadingProfile}
        onSendMessage={() => {
          if (selectedUserId) {
            void handleOpenChatFromProfile(selectedUserId);
          }
        }}
        onAddFriend={() => {
          // Add friend logic
        }}
      />
      {loading && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg">
          Processing...
        </div>
      )}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
          {error}
        </div>
      )}
    </>
  );
};

export const MessageWrapper: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return <>{children}</>;
};

export default RoomManager;
