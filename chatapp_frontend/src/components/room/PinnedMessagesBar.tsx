// src/components/room/PinnedMessagesBar.tsx

import { useState } from 'react';
import { Pin, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { PinnedMessage } from '@/types/roomActions';

interface PinnedMessagesBarProps {
  pinnedMessages: PinnedMessage[];
  onUnpinMessage: (messageId: string) => Promise<void>;
  onGoToMessage: (messageId: string) => void;
  canUnpin?: boolean;
}

export const PinnedMessagesBar: React.FC<PinnedMessagesBarProps> = ({
  pinnedMessages,
  onUnpinMessage,
  onGoToMessage,
  canUnpin = false
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (pinnedMessages.length === 0) {
    return null;
  }

  const currentMessage = pinnedMessages[currentIndex];

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : pinnedMessages.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < pinnedMessages.length - 1 ? prev + 1 : 0));
  };

  const handleGoToMessage = () => {
    onGoToMessage(currentMessage.messageId);
  };

  const handleUnpin = (e: React.MouseEvent) => {
    e.stopPropagation();
    void onUnpinMessage(currentMessage.messageId);

    // Adjust current index if needed
    if (currentIndex >= pinnedMessages.length - 1) {
      setCurrentIndex(Math.max(0, pinnedMessages.length - 2));
    }
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 flex items-center space-x-3">
      {/* Pin Icon */}
      <div className="flex-shrink-0">
        <Pin className="w-4 h-4 text-yellow-600" />
      </div>

      {/* Navigation buttons (if multiple messages) */}
      {pinnedMessages.length > 1 && (
        <div className="flex-shrink-0 flex space-x-1">
          <button
            onClick={handlePrevious}
            className="p-1 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100 rounded transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            className="p-1 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100 rounded transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Message Content */}
      <div
        className="flex-1 cursor-pointer hover:bg-yellow-100 rounded p-1 transition-colors"
        onClick={handleGoToMessage}
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-yellow-800">
              {currentMessage.senderName}
            </p>
            <p className="text-sm text-yellow-700">
              {truncateText(currentMessage.content)}
            </p>
          </div>

          {/* Message counter */}
          {pinnedMessages.length > 1 && (
            <div className="flex-shrink-0 ml-3">
              <span className="text-xs text-yellow-600 bg-yellow-200 px-2 py-1 rounded-full">
                {currentIndex + 1}/{pinnedMessages.length}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Unpin button */}
      {canUnpin && (
        <div className="flex-shrink-0">
          <button
            onClick={handleUnpin}
            className="p-1 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100 rounded transition-colors"
            title="Bỏ ghim tin nhắn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
