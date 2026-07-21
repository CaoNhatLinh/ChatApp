import { useEffect } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { useFetchReceivedRequests, useFriendStore, useReceivedRequests } from "@/features/relationships/model/friend.store";
import { FriendsListSkeleton } from "@/features/relationships/components/Contacts/ContactListSkeletons";
import { SurfacePanel, SectionHeader } from "@/shared/ui";
import { FriendItem } from "@/features/relationships/components/friend/FriendItem";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

export const ReceivedRequestPage = () => {
  const { user } = useAuthStore();

  const fetchReceivedRequests = useFetchReceivedRequests();
  const receivedRequests = useReceivedRequests();
  const loading = useFriendStore((state) => state.loadingReceived);

  useEffect(() => {
    if (user?.userId) {
      void fetchReceivedRequests();
    }
  }, [fetchReceivedRequests, user?.userId]);

  const acceptFriendHandle = async (userId: string) => {
    try {
      if (!user) {
        return;
      }
      await useFriendStore.getState().handleAccept(userId);
    } catch (error) {
      console.error("Error accepting friend request:", error instanceof Error ? error.message : error);
    }
  };

  if (loading) {
    return (
      <motion.section
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.panelReveal}
      >
        <FriendsListSkeleton rows={3} />
      </motion.section>
    );
  }

  return (
    <motion.section
      className="space-y-4"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.panelReveal}
    >
      <SurfacePanel className="layout-stack">
        <SectionHeader title="Yêu cầu kết bạn đã gửi" description="Các lời mời kết bạn đang chờ phản hồi." />
      </SurfacePanel>

      {receivedRequests?.userDetails.length === 0 ? (
        <SurfacePanel className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Bạn chưa có lời mời kết bạn nào.</p>
        </SurfacePanel>
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
    </motion.section>
  );
};
