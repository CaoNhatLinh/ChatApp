// src/components/room/PinnedMessagesModal.tsx

import React, { useState } from 'react';
import { X, Pin, MessageSquare, Calendar, User, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import type { PinnedMessage } from '@/types/roomActions';

interface PinnedMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  pinnedMessages: PinnedMessage[];
  onUnpinMessage: (messageId: string) => Promise<void>;
  onGoToMessage: (messageId: string) => void;
}

const PinnedMessageItem: React.FC<{
  message: PinnedMessage;
  isCurrentUserAdmin: boolean;
  isCurrentUserModerator: boolean;
  isMessageOwner: boolean;
  onUnpin: () => void;
  onGoTo: () => void;
}> = ({ message, isCurrentUserAdmin, isCurrentUserModerator, isMessageOwner, onUnpin, onGoTo }) => {
  const canUnpin = isCurrentUserAdmin || isCurrentUserModerator || isMessageOwner;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700 transition-colors group">
      <div className="flex items-start space-x-3">
        {/* Pin icon */}
        <div className="flex-shrink-0 mt-1">
          <Pin className="w-4 h-4 text-yellow-400" />
        </div>

        {/* Message content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <div className="flex items-center space-x-2 text-sm text-gray-300">
              <User className="w-3 h-3" />
              <span className="font-medium">{message.senderName}</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-400">{formatDate(message.createdAt)}</span>
            </div>
          </div>

          <div
            className="text-white text-sm mb-3 cursor-pointer hover:text-blue-400 transition-colors line-clamp-3"
            onClick={onGoTo}
          >
            {message.content}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <Calendar className="w-3 h-3" />
              <span>Pinned {formatDate(message.pinnedAt)}</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={onGoTo}
                className="text-blue-400 hover:text-blue-300 text-xs px-2 py-1 rounded hover:bg-gray-600 transition-colors"
              >
                Go to message
              </button>

              {canUnpin && (
                <button
                  onClick={onUnpin}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1 rounded hover:bg-gray-600 transition-all"
                  title="Unpin message"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PinnedMessagesModal: React.FC<PinnedMessagesModalProps> = ({
  isOpen,
  onClose,
  pinnedMessages,
  onUnpinMessage,
  onGoToMessage
}) => {
  const { user } = useAuthStore();
  const [, setLoading] = useState<string | null>(null);

  const handleUnpin = async (messageId: string) => {
    setLoading(messageId);
    try {
      await onUnpinMessage(messageId);
    } catch (error) {
      console.error('Error unpinning message:', error instanceof Error ? error.message : error);
    } finally {
      setLoading(null);
    }
  };

  const handleGoToMessage = (messageId: string) => {
    onGoToMessage(messageId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <Pin className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-semibold text-white">
              Pinned Messages ({pinnedMessages.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {pinnedMessages.length > 0 ? (
            <div className="space-y-4">
              {pinnedMessages
                .sort((a, b) => new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime())
                .map(message => (
                  <PinnedMessageItem
                    key={message.messageId}
                    message={message}
                    isCurrentUserAdmin={true}
                    isCurrentUserModerator={false}
                    isMessageOwner={message.senderId === user?.userId}
                    onUnpin={() => handleUnpin(message.messageId)}
                    onGoTo={() => handleGoToMessage(message.messageId)}
                  />
                ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">No pinned messages</h3>
              <p className="text-gray-400 text-sm">
                Important messages will appear here when they are pinned.
              </p>
            </div>
          )}
        </div>

        {pinnedMessages.length > 0 && (
          <div className="p-4 border-t border-gray-700 text-center">
            <p className="text-xs text-gray-400">
              Tip: Right-click on any message to pin or unpin it
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
