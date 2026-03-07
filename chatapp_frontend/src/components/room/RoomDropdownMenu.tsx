// src/components/room/RoomDropdownMenu.tsx

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Settings, UserPlus, Edit, Bell } from 'lucide-react';
import type { Conversation } from '@/types/conversation';

interface RoomDropdownMenuProps {
  conversation: Conversation;
  memberRole: 'admin' | 'moderator' | 'member';
  onShowSettings: () => void;
  onInviteMembers: () => void;
  onChangeNickname: () => void;
  onNotificationSettings: () => void;
}

export const RoomDropdownMenu: React.FC<RoomDropdownMenuProps> = ({
  onShowSettings,
  onInviteMembers,
  onChangeNickname,
  onNotificationSettings
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

  const handleMenuItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 text-gray-300 hover:text-white hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors"
      >
        <span className="text-sm font-medium">Tùy chọn</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {/* Invite Members - Always show for now, can restrict later */}
            <button
              onClick={() => handleMenuItemClick(onInviteMembers)}
              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center space-x-3"
            >
              <UserPlus className="w-4 h-4" />
              <span>Mời thành viên</span>
            </button>

            {/* Room Settings - Always show for now, can restrict later */}
            <button
              onClick={() => handleMenuItemClick(onShowSettings)}
              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center space-x-3"
            >
              <Settings className="w-4 h-4" />
              <span>Cài đặt phòng</span>
            </button>

            {/* Notification Settings */}
            <button
              onClick={() => handleMenuItemClick(onNotificationSettings)}
              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center space-x-3"
            >
              <Bell className="w-4 h-4" />
              <span>Cài đặt thông báo</span>
            </button>

            {/* Change Nickname */}
            <button
              onClick={() => handleMenuItemClick(onChangeNickname)}
              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center space-x-3"
            >
              <Edit className="w-4 h-4" />
              <span>Đổi biệt danh</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
