// src/components/room/RoomMenuButton.tsx

import React, { useState } from 'react';
import { MoreVertical, Settings, Users, Pin, Trash2, LogOut, Shield, Crown } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import type { Conversation } from '@/types/conversation';

interface RoomMenuButtonProps {
  conversation: Conversation;
  onShowSettings: () => void;
  onShowMembers: () => void;
  onShowPinnedMessages: () => void;
  onLeaveRoom: () => void;
  onDissolveRoom?: () => void;
  memberRole?: 'admin' | 'moderator' | 'member';
}

export const RoomMenuButton: React.FC<RoomMenuButtonProps> = ({
  conversation,
  onShowSettings,
  onShowMembers,
  onShowPinnedMessages,
  onLeaveRoom,
  onDissolveRoom,
  memberRole = 'member'
}) => {
  const { user } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);

  const isAdmin = memberRole === 'admin' || conversation.createdBy === user?.userId;
  const isGroupConversation = conversation.type === 'group';

  const handleAction = (action: () => void) => {
    action();
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        title="Room options"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowMenu(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 top-12 bg-gray-700 border border-gray-600 rounded-lg py-2 w-56 z-20 shadow-lg">
            {/* View Members */}
            <button
              onClick={() => handleAction(onShowMembers)}
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600 flex items-center space-x-3"
            >
              <Users className="w-4 h-4" />
              <span>View Members</span>
              <span className="ml-auto text-gray-400 text-xs">
                {conversation.memberCount || 0}
              </span>
            </button>

            {/* Pinned Messages */}
            <button
              onClick={() => handleAction(onShowPinnedMessages)}
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600 flex items-center space-x-3"
            >
              <Pin className="w-4 h-4" />
              <span>Pinned Messages</span>
            </button>

            {/* Room Settings - Only for groups and admins */}
            {isGroupConversation && isAdmin && (
              <>
                <div className="border-t border-gray-600 my-1" />
                <button
                  onClick={() => handleAction(onShowSettings)}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600 flex items-center space-x-3"
                >
                  <Settings className="w-4 h-4" />
                  <span>Room Settings</span>
                </button>
              </>
            )}

            {/* Dangerous Actions */}
            <div className="border-t border-gray-600 my-1" />

            {/* Leave Room */}
            <button
              onClick={() => handleAction(onLeaveRoom)}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-600 flex items-center space-x-3"
            >
              <LogOut className="w-4 h-4" />
              <span>Leave {isGroupConversation ? 'Room' : 'Conversation'}</span>
            </button>

            {/* Dissolve Room - Only for group admins */}
            {isGroupConversation && isAdmin && onDissolveRoom && (
              <button
                onClick={() => handleAction(onDissolveRoom)}
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-600 flex items-center space-x-3"
              >
                <Trash2 className="w-4 h-4" />
                <span>Dissolve Room</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Role indicator component for current user in room header
export const RoleIndicator: React.FC<{ role: 'admin' | 'moderator' | 'member' }> = ({ role }) => {
  switch (role) {
    case 'admin':
      return (
        <div className="flex items-center space-x-1 text-yellow-400 text-xs">
          <Crown className="w-3 h-3" />
          <span>Admin</span>
        </div>
      );
    case 'moderator':
      return (
        <div className="flex items-center space-x-1 text-blue-400 text-xs">
          <Shield className="w-3 h-3" />
          <span>Moderator</span>
        </div>
      );
    default:
      return null;
  }
};
