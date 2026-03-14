import { FriendItem } from "@/features/relationships/components/friend/FriendItem";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { useFetchReceivedRequests, useFriendStore, useReceivedRequests } from "@/features/relationships/model/friend.store";
import { useEffect } from "react";
export const ReceivedRequestPage = () => {
  const { user } = useAuthStore();

  const fetchReceivedRequests = useFetchReceivedRequests();
  const receivedRequests = useReceivedRequests();
  const loading = useFriendStore(state => state.loadingReceived);
  useEffect(() => {
    if (user?.userId) {
      void fetchReceivedRequests();
    }
  }, [user?.userId, fetchReceivedRequests]);
  const acceptFriendHandle = async (userId: string) => {
    try {
      if (!user) {
        console.error("User not found");
        return;
      }
      await useFriendStore.getState().handleAccept(userId);
    } catch (error) {
      console.error("Error accepting friend request:", error instanceof Error ? error.message : error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }
  return (
    <div className="bg-gray-700 p-4 rounded-lg shadow-sm">
      <h2 className="font-bold mb-4 text-gray-300">Yêu cầu kết bạn đã gửi</h2>

      {receivedRequests?.userDetails.length === 0 ? (
        <p className="text-gray-400 text-sm">Bạn chưa gửi yêu cầu kết bạn nào</p>
      ) : (
        <div className="space-y-2">
          {receivedRequests?.userDetails.map((request, idx) => (
            <FriendItem
              key={`sent-${request.userId ?? idx}`}
              friend={request}
              hasPendingRequest={true}
              onAcceptFriend={acceptFriendHandle}
            />
          ))}
        </div>
      )}
    </div>
  );
};