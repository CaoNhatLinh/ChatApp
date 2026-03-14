import React, { useState } from "react";
import { Check, Clock, UserPlus, X, MessageCircle, MoreVertical } from "lucide-react";
import { useMessenger } from "@/features/messenger/model/useMessenger";
import { findDmConversation, createConversation } from "@/features/messenger/api/messenger.api";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/Avatar";
import { Button } from "@/shared/ui/Button";
import { Badge } from "@/shared/ui/Badge";
import { cn } from "@/shared/lib/cn";
import { useIsUserOnline } from "@/features/presence/model/presence.store";
import { friendRequestErrors, showSuccessToast } from "@/shared/lib/errorHandler";
import type { UserDTO } from "@/entities/user/model/user.types";

interface FriendItemProps {
  friend: UserDTO;
  onClick?: () => void;
  onAddFriend?: (friend: UserDTO) => Promise<void>;
  onAcceptFriend?: (friendId: string) => Promise<void>;
  onRejectFriend?: (friendId: string) => Promise<void>;
  isFriend?: boolean;
  hasPendingRequest?: boolean;
  isSentRequest?: boolean;
  isReceivedRequest?: boolean;
}

export const FriendItem: React.FC<FriendItemProps> = ({
  friend,
  onClick,
  onAddFriend,
  onAcceptFriend,
  onRejectFriend,
  isFriend = false,
  hasPendingRequest = false,
  isSentRequest = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuthStore();
  const isFriendOnline = useIsUserOnline(friend.userId);
  const { selectConversation } = useMessenger();

  const handleAddFriend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAddFriend || isLoading) return;

    setIsLoading(true);

    try {
      await onAddFriend(friend);
      showSuccessToast(`Friend request sent to ${friend.displayName}`);
    } catch (error) {
      friendRequestErrors.send(error);
    } finally {
      setIsLoading(false);
    }
  };

  const openChatWithFriend = async (friend: UserDTO) => {
    if (!friend || !friend.userId || !user?.userId) {
      return;
    }

    try {
      const conversation = await findDmConversation(user.userId, friend.userId);
      void selectConversation(conversation.conversationId);
    } catch {
      try {
        const conv = await createConversation({
          type: "dm",
          memberIds: [friend.userId],
        });
        void selectConversation(conv.conversationId);
        showSuccessToast(`Started conversation with ${friend.displayName}`);
      } catch (error) {
        friendRequestErrors.send(error);
      }
    }
  };

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAcceptFriend || isLoading) return;

    setIsLoading(true);
    try {
      await onAcceptFriend(friend.userId);
      showSuccessToast(`Friend request from ${friend.displayName} accepted`);
    } catch (error) {
      friendRequestErrors.accept(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRejectFriend || isLoading) return;

    setIsLoading(true);
    try {
      await onRejectFriend(friend.userId);
      showSuccessToast(`Friend request from ${friend.displayName} declined`);
    } catch (error) {
      friendRequestErrors.reject(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3 rounded-lg hover:bg-accent cursor-pointer transition",
        isLoading && "opacity-70"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="relative">
          <Avatar className="h-12 w-12">
            <AvatarImage src={friend.avatarUrl || undefined} alt={friend.displayName} />
            <AvatarFallback>
              {(friend.displayName || friend.userName)[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className={cn(
            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-card",
            isFriendOnline ? "bg-green-500" : "bg-muted-foreground"
          )} />
        </div>

        <div className="min-w-0">
          <div className="font-semibold truncate">
            {friend.displayName || friend.userName}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            @{friend.userName}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isFriend ? (
          <>
            <Button
              variant="default"
              size="icon"
              className="h-8 w-8"
              title="Message"
              onClick={(e) => {
                e.stopPropagation();
                void openChatWithFriend(friend);
              }}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="More options"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Context menu
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </>
        ) : hasPendingRequest ? (
          <>
            <Button
              onClick={handleAccept}
              disabled={isLoading}
              size="icon"
              className="h-8 w-8 bg-green-600 hover:bg-green-700"
              title="Accept"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleReject}
              disabled={isLoading}
              variant="destructive"
              size="icon"
              className="h-8 w-8"
              title="Reject"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : isSentRequest ? (
          <>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> Pending
            </Badge>
            <Button
              onClick={handleReject}
              disabled={isLoading}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Cancel request"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button
            onClick={handleAddFriend}
            disabled={isLoading}
            size="sm"
            className="gap-1"
          >
            <UserPlus className="h-4 w-4" /> Add Friend
          </Button>
        )}
      </div>
    </div>
  );
};