import { useState } from "react";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { useMessenger } from "@/features/messenger/model/useMessenger";
import { createConversation, findDmConversation } from "@/features/messenger/api/messenger.api";
import { getUserProfile } from "@/features/profile/api/users.api";
import type { CreateConversationRequest } from "@/features/messenger/types/messenger.types";
import type { UserDTO } from "@/entities/user/model/user.types";
import type { UserProfileModal as UserProfile } from "@/shared/types/room.types";
import { UserProfileModal } from "@/features/profile/components/user/UserProfileModal";
import { FRIEND_COPY } from "@/features/relationships/constants/friends.constants";
import { useFriendTabsState } from "@/features/relationships/hooks/useFriendTabsState";
import {
  useFriendStore,
} from "../../model/friend.store";
import { ContactListHeader } from "./ContactListHeader";
import { ContactAddSection } from "./ContactAddSection";
import { ContactFriendsSection } from "./ContactFriendsSection";
import { ContactRequestsSection } from "./ContactRequestsSection";
import { notifyError, notifySuccess } from "@/shared/lib/notification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { localizeText } from "@/shared/i18n";

export const ContactListView = () => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | undefined>(undefined);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [unfriendTargetId, setUnfriendTargetId] = useState<string | null>(null);
  const [isUnfriendLoading, setIsUnfriendLoading] = useState(false);

  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    globalSearchQuery,
    setGlobalSearchQuery,
    friends,
    visibleFriends,
    requests,
    searchResults,
    sentRequestIds,
    loadingFriends,
    loadingReceived,
    loadingSearch,
    loadingSent,
  } = useFriendTabsState();

  const { user } = useAuthStore();
  const { selectConversation, setActiveView, setSidebarOpen } = useMessenger();

  const handleAcceptAction = useFriendStore((state) => state.handleAccept);
  const handleRejectAction = useFriendStore((state) => state.handleReject);
  const handleUnfriendAction = useFriendStore((state) => state.unfriend);
  const handleSendRequestAction = useFriendStore((state) => state.sendFriendRequest);

  const handleUserClick = async (targetUserId: string) => {
    setSelectedUserId(targetUserId);
    setIsProfileModalOpen(true);
    setIsProfileLoading(true);

    try {
      const profile: UserDTO = await getUserProfile(targetUserId);
      setUserProfile({
        userId: profile.userId,
        username: profile.userName,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        joinedAt: profile.createdAt,
        isOnline: profile.status === "ONLINE",
        lastSeen: profile.lastActive || undefined,
      });
    } catch (error) {
      console.error("Failed to load user profile", error);
      notifyError(FRIEND_COPY.status.openProfileFailed);
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handleOpenChat = async (targetUserId: string) => {
    if (!user?.userId) return;

    try {
      let conversation;
      try {
        conversation = await findDmConversation(user.userId, targetUserId);
      } catch {
        conversation = await createConversation({
          type: "dm",
          memberIds: [targetUserId],
        } as CreateConversationRequest);
      }

      await selectConversation(conversation.conversationId);
      setSidebarOpen(false);
      setActiveView("chat");
      notifySuccess(FRIEND_COPY.actions.openChatSuccess);
    } catch (error) {
      console.error("Open conversation failed", error);
      notifyError(FRIEND_COPY.actions.openChatFailed);
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    try {
      await handleSendRequestAction(targetUserId);
      notifySuccess(FRIEND_COPY.actions.sentSuccess);
    } catch {
      notifyError(FRIEND_COPY.actions.sentFailed);
    }
  };

  const handleAccept = async (senderId: string) => {
    try {
      await handleAcceptAction(senderId);
      notifySuccess(FRIEND_COPY.actions.acceptSuccess);
    } catch {
      notifyError(FRIEND_COPY.actions.acceptFailed);
    }
  };

  const handleReject = async (senderId: string) => {
    try {
      await handleRejectAction(senderId);
      notifySuccess(FRIEND_COPY.actions.rejectSuccess);
    } catch {
      notifyError(FRIEND_COPY.actions.rejectFailed);
    }
  };

  const handleUnfriend = async (friendId: string) => {
    setIsUnfriendLoading(true);
    try {
      await handleUnfriendAction(friendId);
      setUnfriendTargetId(null);
      notifySuccess(FRIEND_COPY.actions.unfriendSuccess);
    } catch {
      notifyError(FRIEND_COPY.actions.unfriendFailed);
    } finally {
      setIsUnfriendLoading(false);
    }
  };

  return (
    <div className="relative h-full w-full flex flex-col bg-background">
      <ContactListHeader
        activeTab={activeTab}
        requestCount={requests.length}
        showSearch={activeTab === "friends"}
        searchQuery={searchQuery}
        onTabChange={setActiveTab}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto w-full max-w-4xl p-4 sm:p-6 lg:p-10">
          {activeTab === "friends" ? (
            <ContactFriendsSection
              title={FRIEND_COPY.sectionTitle.friends}
              friendsCount={friends.length}
              visibleFriends={visibleFriends}
              isLoading={loadingFriends}
              onOpenChat={handleOpenChat}
              onUnfriend={(friendId) => setUnfriendTargetId(friendId)}
              onUserClick={handleUserClick}
            />
          ) : null}

          {activeTab === "add" ? (
            <ContactAddSection
              searchResults={searchResults}
              friendsIds={new Set(friends.map((friend) => friend.userId))}
              pendingIds={sentRequestIds}
              isLoading={loadingSearch || loadingSent}
              globalSearchQuery={globalSearchQuery}
              onSearchChange={setGlobalSearchQuery}
              onUserClick={handleUserClick}
              onSendRequest={handleSendRequest}
              currentUserId={user?.userId}
            />
          ) : null}

          {activeTab === "requests" ? (
            <ContactRequestsSection
              requests={requests}
              isLoading={loadingReceived}
              onAccept={handleAccept}
              onReject={handleReject}
              onUserClick={handleUserClick}
            />
          ) : null}

          {activeTab !== "add" && !searchQuery && globalSearchQuery.length === 0 ? (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              {activeTab === "friends"
                ? FRIEND_COPY.filters.noFriendsHint
                : activeTab === "requests"
                  ? FRIEND_COPY.filters.noRequestsHint
                  : FRIEND_COPY.filters.noSearchHint}
            </p>
          ) : null}
        </div>
      </div>

      {selectedUserId ? <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          userId={selectedUserId}
          userProfile={userProfile}
          isLoading={isProfileLoading}
          onSendMessage={async () => {
            await handleOpenChat(selectedUserId);
            setIsProfileModalOpen(false);
          }}
          onReport={() => setIsProfileModalOpen(false)}
        /> : null}
      <ConfirmDialog
        open={Boolean(unfriendTargetId)}
        onOpenChange={(open) => {
          if (!open && !isUnfriendLoading) setUnfriendTargetId(null);
        }}
        title={localizeText("Hủy kết bạn")}
        description={FRIEND_COPY.actions.unfriendConfirm}
        confirmLabel={localizeText("Hủy kết bạn")}
        destructive
        loading={isUnfriendLoading}
        onConfirm={() => {
          if (unfriendTargetId) return handleUnfriend(unfriendTargetId);
        }}
      />
    </div>
  );
};

export default ContactListView;
