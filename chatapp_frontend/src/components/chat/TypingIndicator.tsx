import { useConversationStore } from '@/store/conversationStore';
import { useAuthStore } from '@/store/authStore';

interface TypingIndicatorProps {
  conversationId: string;
}

export const TypingIndicator = ({ conversationId }: TypingIndicatorProps) => {
  const { getTypingUsersForConversation } = useConversationStore();
  const { user } = useAuthStore();

  // Get typing users for this conversation and filter out current user
  const typingUsers = getTypingUsersForConversation(conversationId);
  const otherTypingUsers = typingUsers.filter(typingUser => typingUser.userId !== user?.userId);

  if (otherTypingUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (otherTypingUsers.length === 1) {
      const typingUser = otherTypingUsers[0];
      const displayName = typingUser.user?.displayName || typingUser.user?.userName || 'Ai đó';
      return `${displayName} đang nhập...`;
    } else if (otherTypingUsers.length === 2) {
      const names = otherTypingUsers.map(tu => tu.user?.displayName || tu.user?.userName || 'Ai đó');
      return `${names.join(' và ')} đang nhập...`;
    } else if (otherTypingUsers.length === 3) {
      const names = otherTypingUsers.slice(0, 2).map(tu => tu.user?.displayName || tu.user?.userName || 'Ai đó');
      return `${names.join(', ')} và 1 người khác đang nhập...`;
    } else {
      return `${otherTypingUsers.length} người đang nhập...`;
    }
  };

  return (
    <div className="px-4 py-2 border-t border-gray-700">
      <div className="flex items-center space-x-2 text-sm text-gray-400">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
        <span className="italic">{getTypingText()}</span>
      </div>
    </div>
  );
};
