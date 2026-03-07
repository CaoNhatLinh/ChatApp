import { FriendItem } from "@/components/friend/FriendItem";
import { FriendList } from "@/components/friend/FriendList";
import UserSearch from "@/components/friend/UserSearch";
import { useAuthStore } from "@/store/authStore";
import { useFriendStore } from "@/store/friendStore";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Users, UserPlus, UserCheck } from "lucide-react";
import type { FriendDetails } from "@/types/friend";
import { ReceivedRequestPage } from "@/components/friend/ReceivedRequestPage";
import type { UserDTO } from "@/types";

export const FriendsPage = () => {
  const { searchResults, sendFriendRequest, pendingRequests, friends, fetchSentRequests, fetchFriends } = useFriendStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'all' | 'add' | 'sent'>('all');
  const [onlineOpen, setOnlineOpen] = useState(true);
  const [pendingOpen, setPendingOpen] = useState(true);

  useEffect(() => {
    if (!user?.userId) {
      return;
    }
    void fetchSentRequests(user.userId);
    void fetchFriends(user.userId);
  }, [fetchSentRequests, fetchFriends, user?.userId]);

  const addFriendHandle = async (friend: UserDTO): Promise<void> => {
    try {
      if (!user) {
        console.error("User not found");
        return;
      }
      await sendFriendRequest(user.userId, friend.userId);
    } catch (error) {
      console.error("Error sending friend request:", error instanceof Error ? error.message : error);
    }
  };

  const onlineFriends: FriendDetails = friends ?? { userId: '', status: 'ACCEPTED', userDetails: [] };
  const pendingFriends = pendingRequests?.userDetails || [];

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary p-2 rounded-lg">
              <Users className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Friends</h1>
              <p className="text-muted-foreground text-sm">Manage your connections</p>
            </div>
          </div>
        </div>

        <div className="flex space-x-1 mt-4 bg-muted p-1 rounded-lg">
          <button
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-200 ${activeTab === 'all'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'hover:bg-accent'
              }`}
            onClick={() => setActiveTab('all')}
          >
            <div className="flex items-center justify-center space-x-2">
              <Users className="w-4 h-4" />
              <span>All Friends</span>
            </div>
          </button>

          <button
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-200 ${activeTab === 'sent'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'hover:bg-accent'
              }`}
            onClick={() => setActiveTab('sent')}
          >
            <div className="flex items-center justify-center space-x-2">
              <UserCheck className="w-4 h-4" />
              <span>Requests</span>
            </div>
          </button>

          <button
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-200 ${activeTab === 'add'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'hover:bg-accent'
              }`}
            onClick={() => setActiveTab('add')}
          >
            <div className="flex items-center justify-center space-x-2">
              <UserPlus className="w-4 h-4" />
              <span>Add Friend</span>
            </div>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'all' ? (
          <AllFriendsTab
            onlineFriends={onlineFriends}
            pendingFriends={{
              userId: '',
              status: 'PENDING',
              userDetails: pendingFriends
            }}
            onlineOpen={onlineOpen}
            pendingOpen={pendingOpen}
            onToggleOnline={() => setOnlineOpen(!onlineOpen)}
            onTogglePending={() => setPendingOpen(!pendingOpen)}
          />
        ) : activeTab === 'add' ? (
          <AddFriendsTab
            searchResults={searchResults}
            addFriendHandle={addFriendHandle}
            isFriend={false}
          />
        ) : (
          <div className="bg-card rounded-lg p-6 border border-border">
            <ReceivedRequestPage />
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsPage;

interface AllFriendsTabProps {
  onlineFriends: FriendDetails;
  pendingFriends: FriendDetails;
  onlineOpen: boolean;
  pendingOpen: boolean;
  onToggleOnline: () => void;
  onTogglePending: () => void;
}

const AllFriendsTab = ({
  onlineFriends,
  pendingFriends,
  onlineOpen,
  pendingOpen,
  onToggleOnline,
  onTogglePending
}: AllFriendsTabProps) => {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg overflow-hidden border border-border">
        <div
          className="flex items-center justify-between p-4 hover:bg-accent cursor-pointer transition-colors"
          onClick={onToggleOnline}
        >
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="font-medium">Online</span>
            <span className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">
              {onlineFriends?.userDetails?.length || 0}
            </span>
          </div>
          <div className="text-muted-foreground">
            {onlineOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>

        {onlineOpen && onlineFriends.userDetails.length > 0 && (
          <div className="px-4 pb-4">
            <div className="space-y-2">
              {onlineFriends.userDetails.map((friend, idx) => (
                <div key={`online-${friend.userId ?? idx}`} className="bg-muted/50 rounded-lg p-3">
                  <FriendItem
                    friend={friend}
                    isFriend={true}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-lg overflow-hidden border border-border">
        <div
          className="flex items-center justify-between p-4 hover:bg-accent cursor-pointer transition-colors"
          onClick={onTogglePending}
        >
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="font-medium">Pending Requests</span>
            <span className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">
              {pendingFriends.userDetails.length}
            </span>
          </div>
          <div className="text-muted-foreground">
            {pendingOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>

        {pendingOpen && pendingFriends.userDetails.length > 0 && (
          <div className="px-4 pb-4">
            <div className="space-y-2">
              {pendingFriends.userDetails.map((user, idx) => (
                <div key={`pending-${user.userId ?? idx}`} className="bg-muted/50 rounded-lg p-3">
                  <FriendItem
                    friend={user}
                    isFriend={false}
                    isSentRequest={true}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-lg p-4 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">All Friends</h3>
          <span className="text-muted-foreground text-sm">
            {onlineFriends.userDetails.length + pendingFriends.userDetails.length} total
          </span>
        </div>
        <FriendList />
      </div>
    </div>
  );
};

interface AddFriendsTabProps {
  searchResults: UserDTO[];
  addFriendHandle: (friend: UserDTO) => Promise<void>;
  isFriend: boolean;
}

const AddFriendsTab = ({
  searchResults,
  addFriendHandle,
  isFriend
}: AddFriendsTabProps) => {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg p-6 mb-6 border border-border">
        <div className="text-center mb-6">
          <div className="bg-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">Add New Friends</h2>
          <p className="text-muted-foreground">
            You can add friends by searching for their username
          </p>
        </div>

        <div className="bg-muted rounded-lg p-4 mb-4">
          <h3 className="font-medium mb-3">How to add friends:</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Enter the complete username (e.g., username#1234)</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Send a friend request</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Wait for them to accept your request</span>
            </li>
          </ul>
        </div>

        <UserSearch />
      </div>

      {searchResults && searchResults.length > 0 && (
        <div className="bg-card rounded-lg p-6 border border-border">
          <h3 className="font-medium mb-4">Search Results</h3>
          <div className="space-y-3">
            {searchResults.map((user: UserDTO, idx: number) => (
              <div key={user.userId ?? `friend-item-${idx}`} className="bg-muted/50 rounded-lg p-4">
                <FriendItem
                  friend={user}
                  onAddFriend={addFriendHandle}
                  isFriend={isFriend}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};