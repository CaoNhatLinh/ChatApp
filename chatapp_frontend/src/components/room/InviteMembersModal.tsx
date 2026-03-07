// src/components/room/InviteMembersModal.tsx

import { useState, useEffect } from 'react';
import { Search, X, Copy, Check, Users } from 'lucide-react';

interface Friend {
  userId: string;
  displayName: string;
  isOnline: boolean;
  avatar?: string;
}

interface InviteMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  onInviteMembers: (memberIds: string[]) => void;
}

// Mock friends data - replace with real API call
const mockFriends: Friend[] = [
  { userId: 'friend1', displayName: 'Nguyễn Văn A', isOnline: true },
  { userId: 'friend2', displayName: 'Trần Thị B', isOnline: false },
  { userId: 'friend3', displayName: 'Lê Văn C', isOnline: true },
  { userId: 'friend4', displayName: 'Phạm Thị D', isOnline: false },
  { userId: 'friend5', displayName: 'Hoàng Văn E', isOnline: true },
];

export const InviteMembersModal: React.FC<InviteMembersModalProps> = ({
  isOpen,
  onClose,
  conversationId,
  onInviteMembers
}) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load friends list - replace with real API call
      setLoading(true);
      setTimeout(() => {
        setFriends(mockFriends);
        setFilteredFriends(mockFriends);
        setLoading(false);
      }, 500);

      // Generate invite link - replace with real API call
      setInviteLink(`https://chatapp.com/invite/${conversationId}`);
    }
  }, [isOpen, conversationId]);

  useEffect(() => {
    const filtered = friends.filter(friend =>
      friend.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredFriends(filtered);
  }, [friends, searchTerm]);

  const handleToggleFriend = (friendId: string) => {
    const newSelected = new Set(selectedFriends);
    if (newSelected.has(friendId)) {
      newSelected.delete(friendId);
    } else {
      newSelected.add(friendId);
    }
    setSelectedFriends(newSelected);
  };

  const handleInvite = () => {
    if (selectedFriends.size > 0) {
      onInviteMembers(Array.from(selectedFriends));
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err instanceof Error ? err.message : err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Mời thành viên</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Invite Link Section */}
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Link mời</h3>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={inviteLink}
              readOnly
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
            />
            <button
              onClick={handleCopyLink}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center space-x-1"
            >
              {linkCopied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="text-sm">Đã sao chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="text-sm">Sao chép</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Friends List Section */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="p-6 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Tìm kiếm bạn bè..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Friends List */}
          <div className="flex-1 overflow-y-auto px-6">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex items-center space-x-3 animate-pulse">
                    <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
                    <div className="flex-1 h-4 bg-gray-700 rounded"></div>
                    <div className="w-5 h-5 bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
            ) : filteredFriends.length > 0 ? (
              <div className="space-y-2">
                {filteredFriends.map((friend) => (
                  <div
                    key={friend.userId}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
                    onClick={() => handleToggleFriend(friend.userId)}
                  >
                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        {friend.displayName.charAt(0).toUpperCase()}
                      </div>
                      {friend.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
                      )}
                    </div>

                    {/* Friend info */}
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{friend.displayName}</p>
                      <p className="text-gray-400 text-xs">
                        {friend.isOnline ? 'Đang hoạt động' : 'Không hoạt động'}
                      </p>
                    </div>

                    {/* Checkbox */}
                    <div className="flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedFriends.has(friend.userId)}
                        onChange={() => handleToggleFriend(friend.userId)}
                        className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Không tìm thấy bạn bè nào</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Đã chọn {selectedFriends.size} người
            </p>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleInvite}
                disabled={selectedFriends.size === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
              >
                Mời ({selectedFriends.size})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
