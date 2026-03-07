import { useState } from "react";
import { createConversation } from "@/api/conversationApi";
import { useConversationStore } from "@/store/conversationStore";
import type { ConversationRequest } from "@/types/conversation";
import { X, Users, Hash, Lock } from "lucide-react";

interface Props {
  onClose: () => void;
}

export const CreateConversationModal = ({ onClose }: Props) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"group" | "direct">("group");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { setSelectedConversation, fetchConversations } = useConversationStore();

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Conversation name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const creationData: ConversationRequest = {
        name: name.trim(),
        type,
        memberIds: [],
      };

      const newConversation = await createConversation(creationData);

      // Refresh conversation list to include new conversation
      await fetchConversations();

      // Auto-select the newly created conversation
      setSelectedConversation(newConversation);

      // Close modal
      onClose();
    } catch {
      setError("Failed to create conversation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl border border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Create New Conversation</h2>
                <p className="text-blue-100 text-sm">Start chatting with your friends</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Conversation Type */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              Conversation Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType("group")}
                className={`flex items-center space-x-3 p-4 rounded-lg border transition-all ${type === "group"
                  ? "border-blue-500 bg-blue-500/10 text-blue-400"
                  : "border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500"
                  }`}
              >
                <Users className="w-5 h-5" />
                <span className="font-medium">Group</span>
              </button>
              <button
                type="button"
                onClick={() => setType("direct")}
                className={`flex items-center space-x-3 p-4 rounded-lg border transition-all ${type === "direct"
                  ? "border-blue-500 bg-blue-500/10 text-blue-400"
                  : "border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500"
                  }`}
              >
                <Hash className="w-5 h-5" />
                <span className="font-medium">Direct</span>
              </button>
            </div>
          </div>

          {/* Conversation Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Conversation Name *
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Enter conversation name..."
                className="w-full px-4 py-3 pl-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                maxLength={50}
              />
              <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xs text-gray-400 text-right">
              {name.length}/50
            </div>
          </div>

          {/* Description (Optional) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for this conversation..."
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              rows={3}
              maxLength={200}
            />
            <div className="text-xs text-gray-400 text-right">
              {description.length}/200
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Lock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-white font-medium">Private Conversation</p>
                <p className="text-gray-400 text-sm">Only invited members can join</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPrivate ? "bg-blue-600" : "bg-gray-600"
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPrivate ? "translate-x-6" : "translate-x-1"
                  }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-900 px-6 py-4 flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Creating...</span>
              </div>
            ) : (
              "Create Conversation"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
