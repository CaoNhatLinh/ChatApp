import { FriendItem } from "@/components/friend/FriendItem";
import { useAuthStore } from "@/store/authStore";
import { useFetchReceivedRequests, useFriendStore, useReceivedRequests } from "@/store/friendStore";
import { useEffect } from "react";
export const ReceivedRequestPage = () => {
  const { user } = useAuthStore();

  // Sử dụng hook để lấy danh sách yêu cầu kết bạn đã gửi
  useFetchReceivedRequests();
  const fetchReceivedRequests = useFetchReceivedRequests();
  const receivedRequests = useReceivedRequests();
  const loading = useFriendStore(state => state.loading);
  useEffect(() => {
    if (user?.userId) {
      void fetchReceivedRequests(user.userId);
    }
  }, [user?.userId, fetchReceivedRequests]);
  const acceptFriendHandle = async (userId: string) => {
    try {
      if (!user) {
        console.error("User not found");
        return;
      }
      await useFriendStore.getState().handleAccept(user.userId, userId);
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