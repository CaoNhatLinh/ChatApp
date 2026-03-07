import { MessageCircle, Users } from "lucide-react";

export const EmptyChat = () => {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center px-8 bg-gray-50 dark:bg-gray-900">
      <div className="relative mb-8">
        <div className="bg-blue-100 dark:bg-gray-800 p-6 rounded-full">
          <MessageCircle className="w-16 h-16 text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      <div className="max-w-md space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Welcome to ChatApp!</h2>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          No conversations yet
        </p>
        <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
          Start connecting with friends by selecting an existing conversation or creating a new one. 
          Your messages will appear here once you begin chatting.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
              <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-gray-50">Start Chatting</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select a conversation from the sidebar to begin messaging
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
              <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-gray-50">Add Friends</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Go to Friends tab to connect with new people
          </p>
        </div>
      </div>

      <div className="mt-16 opacity-50">
        <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-600">
          <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-purple-500 dark:bg-purple-400 rounded-full animate-pulse delay-150"></div>
          <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse delay-300"></div>
        </div>
      </div>
    </div>
  );
};