// src/components/room/PinButton.tsx

import { useState, useRef, useEffect } from 'react';
import { Pin, ChevronDown, X } from 'lucide-react';
import type { PinnedMessage } from '@/types/roomActions';

interface PinButtonProps {
  pinnedMessages: PinnedMessage[];
  onUnpinMessage: (messageId: string) => Promise<void>;
  onGoToMessage: (messageId: string) => void;
  canUnpin?: boolean;
}

export const PinButton: React.FC<PinButtonProps> = ({
  pinnedMessages,
  onUnpinMessage,
  onGoToMessage,
  canUnpin = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleGoToMessage = (messageId: string) => {
    onGoToMessage(messageId);
    setIsOpen(false);
  };

  const handleUnpin = (e: React.MouseEvent, messageId: string) => {
    e.stopPropagation();
    void onUnpinMessage(messageId);
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Pin Button - always show, even when no pinned messages */}
      <button
        onClick={() => pinnedMessages.length > 0 && setIsOpen(!isOpen)}
        disabled={pinnedMessages.length === 0}
        className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${pinnedMessages.length > 0
            ? 'text-yellow-500 hover:text-yellow-400 hover:bg-gray-700'
            : 'text-gray-500 cursor-not-allowed'
          }`}
      >
        <Pin className="w-4 h-4" />
        {pinnedMessages.length > 0 && (
          <>
            <span className="text-sm font-medium">{pinnedMessages.length}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
        {pinnedMessages.length === 0 && (
          <span className="text-sm font-medium">Pin</span>
        )}
      </button>

      {/* Dropdown Menu - only show when there are pinned messages */}
      {isOpen && pinnedMessages.length > 0 && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-gray-700">
            <h3 className="text-sm font-semibold text-white">Tin nhắn đã ghim</h3>
          </div>

          <div className="py-1">
            {pinnedMessages.map((message) => (
              <div
                key={message.messageId}
                className="px-4 py-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-b-0"
                onClick={() => handleGoToMessage(message.messageId)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-yellow-500 font-medium mb-1">
                      {message.senderName}
                    </p>
                    <p className="text-sm text-gray-300 break-words">
                      {truncateText(message.content)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(message.pinnedAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {canUnpin && (
                    <button
                      onClick={(e) => handleUnpin(e, message.messageId)}
                      className="flex-shrink-0 ml-2 p-1 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded transition-colors"
                      title="Bỏ ghim"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
