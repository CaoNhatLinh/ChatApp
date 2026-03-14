import React, { useState, useRef, useEffect } from 'react';
import { emojiData, getRecentEmojis, addRecentEmoji, searchEmojis } from '@/shared/constants/emoji';

interface EmojiPickerProps {
  isVisible: boolean;
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({
  isVisible,
  onEmojiSelect,
  onClose
}) => {
  const [activeCategory, setActiveCategory] = useState('Recent');
  const [searchQuery, setSearchQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Categories including Recent and Search
  const categories = ['Recent', 'Search', ...Object.keys(emojiData)];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  const handleEmojiClick = (emoji: string) => {
    // handle emoji click
    addRecentEmoji(emoji);
    onEmojiSelect(emoji);
    // Close picker after selection
    onClose();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query) {
      setActiveCategory('Search');
    }
  };

  const getEmojisToShow = () => {
    if (activeCategory === 'Recent') {
      const recent = getRecentEmojis();
      // If no recent emojis, show some popular ones
      return recent.length > 0 ? recent : ['😀', '😊', '👍', '❤️', '😂', '🎉', '🔥', '💯'];
    } else if (activeCategory === 'Search') {
      return searchEmojis(searchQuery);
    } else {
      return emojiData[activeCategory as keyof typeof emojiData] || [];
    }
  };

  if (!isVisible) return null;

  return (
    <div
      ref={pickerRef}
      className="emoji-picker w-80 h-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50"
    >
      {/* Search bar */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-600">
        <input
          type="text"
          placeholder="Tìm emoji..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Category tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-600">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-3 py-2 text-xs whitespace-nowrap ${activeCategory === category
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            {category === 'Smileys & People' ? '😀' :
              category === 'Animals & Nature' ? '🐶' :
                category === 'Food & Drink' ? '🍏' :
                  category === 'Travel & Places' ? '🚗' :
                    category === 'Activities' ? '⚽' :
                      category === 'Objects' ? '⌚' :
                        category === 'Symbols' ? '❤️' :
                          category === 'Flags' ? '🏁' :
                            category === 'Recent' ? '🕒' :
                              category === 'Search' ? '🔍' : category}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="p-2 h-64 overflow-y-auto">
        {getEmojisToShow().length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            {activeCategory === 'Recent' ? 'Chưa có emoji gần đây' :
              activeCategory === 'Search' ? 'Không tìm thấy emoji' :
                'Không có emoji'}
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {getEmojisToShow().map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                onClick={() => handleEmojiClick(emoji)}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export { EmojiPicker };
export default EmojiPicker;