import React, { useEffect, useState, useMemo } from 'react';
import { useIsUserOnline } from '@/store/presenceStore';
import { useTrackPresence } from '@/hooks/presence/useTrackPresence';
import { getConversationMembers } from '@/api/conversationApi';
import type { ConversationMember } from '@/types/conversation';
import { User } from 'lucide-react';

// --- MemberItem: reads online status from the store (read-only) ---

interface MemberItemProps {
  member: ConversationMember;
  onMemberClick?: (userId: string) => void;
}

const MemberItem: React.FC<MemberItemProps> = ({ member, onMemberClick }) => {
  const isOnline = useIsUserOnline(member.userId);
  const displayName = member.displayName || member.username || 'Unknown';
  const avatarUrl = member.avatarUrl || '';

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => onMemberClick?.(member.userId)}>
      <div className="relative">
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
            <User className="w-6 h-6 text-gray-400" />
          </div>
        )}
        {isOnline && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{displayName}</p>
        {member.displayName && member.username && (
          <p className="text-gray-400 text-xs truncate">@{member.username}</p>
        )}
        {member.role && member.role !== 'member' && (
          <span className="text-xs text-blue-400 capitalize">{member.role}</span>
        )}
      </div>

      {isOnline && <span className="text-xs text-green-400">Online</span>}
    </div>
  );
};

// --- MemberList: tracks presence for all members ---

interface MemberListProps {
  conversationId: string;
  onClose: () => void;
  onMemberClick?: (userId: string) => void;
}

export const MemberList: React.FC<MemberListProps> = ({ conversationId, onClose, onMemberClick }) => {
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getConversationMembers(conversationId);
        setMembers(response);
      } catch (err) {
        console.error('[MemberList] Failed to fetch members:', err instanceof Error ? err.message : err);
        setError('Không thể tải danh sách thành viên');
      } finally {
        setLoading(false);
      }
    };

    if (conversationId) {
      void fetchMembers();
    }
  }, [conversationId]);

  // Track presence for all loaded members
  const memberIds = useMemo(() => members.map(m => m.userId), [members]);
  useTrackPresence(memberIds);

  if (loading) {
    return (
      <div className="w-64 border-l border-gray-800 bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Thành viên</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-64 border-l border-gray-800 bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Thành viên</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
        </div>
        <div className="text-red-400 text-sm text-center py-4">{error}</div>
      </div>
    );
  }

  return (
    <div className="w-64 border-l border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Thành viên ({members.length})</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-120px)]">
        {members.map((member) => (
          <MemberItem key={member.userId} member={member} onMemberClick={onMemberClick} />
        ))}

        {members.length === 0 && (
          <div className="text-gray-400 text-sm text-center py-4">
            Không có thành viên nào
          </div>
        )}
      </div>
    </div>
  );
};