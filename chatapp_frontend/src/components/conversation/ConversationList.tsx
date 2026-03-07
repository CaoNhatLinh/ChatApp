import { useEffect, useState, useMemo } from "react";
import { ConversationItem } from "./ConversationItem";
import { CreateConversationModal } from "./CreateConversationModal";
import { useConversationStore } from "@/store/conversationStore";
import { useTrackPresence } from "@/hooks/presence/useTrackPresence";
import { Plus, Search, MessageCircle } from "lucide-react";

interface ConversationListProps {
  onConversationSelect?: () => void;
}

export const ConversationList = ({ onConversationSelect }: ConversationListProps) => {
  const { conversations, fetchConversations, loading, error } = useConversationStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      if (!conv.name) return false;

      const searchLower = searchTerm.toLowerCase();

      if (conv.name.toLowerCase().includes(searchLower)) {
        return true;
      }

      if (conv.type === 'dm' && conv.otherParticipant) {
        const { username, displayName } = conv.otherParticipant;
        return (
          username?.toLowerCase().includes(searchLower) ||
          displayName?.toLowerCase().includes(searchLower)
        );
      }

      return false;
    });
  }, [conversations, searchTerm]);

  // Track presence for DM participants currently in the filtered list
  const dmUserIds = useMemo(() =>
    filteredConversations
      .filter(c => c.type === 'dm' && c.otherParticipant)
      .map(c => c.otherParticipant?.userId).filter((id): id is string => Boolean(id)),
    [filteredConversations]
  );
  useTrackPresence(dmUserIds);

  return (
    <div
      className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 rounded-xl shadow-xl dark:shadow-none overflow-hidden"
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-50">Conversations</h2>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-400 dark:hover:bg-blue-300 p-2 rounded-lg transition-colors group shadow-md"
            title="Create new conversation"
          >
            <Plus className="w-4 h-4 text-white dark:text-gray-900 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-50 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mb-3"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading conversations...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm mb-2 text-red-600 dark:text-red-400">Error loading conversations:</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => fetchConversations()}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-400 dark:hover:bg-blue-300 px-4 py-2 rounded-lg text-white dark:text-gray-900 text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            {searchTerm ? (
              <>
                <Search className="w-12 h-12 mb-3 opacity-50 text-gray-400 dark:text-gray-600" />
                <p className="text-sm text-gray-600 dark:text-gray-400">No conversations found for "{searchTerm}"</p>
                <button
                  onClick={() => setSearchTerm("")}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm mt-2"
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <MessageCircle className="w-12 h-12 mb-3 opacity-50 text-gray-400 dark:text-gray-600" />
                <p className="text-sm mb-2 text-gray-600 dark:text-gray-400">No conversations yet</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-400 dark:hover:bg-blue-300 px-4 py-2 rounded-lg text-white dark:text-gray-900 text-sm transition-colors shadow-md"
                >
                  Start your first conversation
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.conversationId}
                conversation={conv}
                onConversationSelect={onConversationSelect}
              />
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <CreateConversationModal onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
};