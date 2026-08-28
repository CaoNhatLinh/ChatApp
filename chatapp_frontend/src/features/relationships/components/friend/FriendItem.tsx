import { useState } from "react";
import { Check, Clock, MessageCircle, MoreVertical, UserPlus, X } from "lucide-react";
import { useMessenger } from "@/features/messenger/model/useMessenger";
import { createConversation, findDmConversation } from "@/features/messenger/api/messenger.api";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/Avatar";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/cn";
import { usePresence } from "@/features/presence/model/presence.store";
import { StatusDot } from "@/features/presence/ui/StatusSelector";
import { friendRequestErrors } from "@/shared/lib/errorHandler";
import { notifyError, notifySuccess } from "@/shared/lib/notification";
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

export const FriendItem = ({
  friend,
  onClick,
  onAddFriend,
  onAcceptFriend,
  onRejectFriend,
  isFriend = false,
  hasPendingRequest = false,
  isSentRequest = false,
}: FriendItemProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuthStore();
  const { presence } = usePresence(friend.userId);
  const isFriendOnline = presence?.isOnline ?? false;
  const friendStatus = presence?.status ?? "OFFLINE";
  const { selectConversation } = useMessenger();

  const handleAddFriend = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!onAddFriend || isLoading) return;

    setIsLoading(true);
    try {
      await onAddFriend(friend);
      notifySuccess(`Đã gửi lời mời kết bạn tới ${friend.displayName}`);
    } catch (error) {
      friendRequestErrors.send(error);
      notifyError(`Không thể gửi lời mời tới ${friend.displayName}`);
    } finally {
      setIsLoading(false);
    }
  };

  const openChatWithFriend = async (friendTarget: UserDTO) => {
    if (!friendTarget || !friendTarget.userId || !user?.userId) return;

    try {
      const conversation = await findDmConversation(user.userId, friendTarget.userId);
      void selectConversation(conversation.conversationId);
    } catch {
      try {
        const conv = await createConversation({
          type: "dm",
          memberIds: [friendTarget.userId],
        });
        void selectConversation(conv.conversationId);
        notifySuccess(`Đã mở cuộc trò chuyện với ${friendTarget.displayName}`);
      } catch (error) {
        friendRequestErrors.send(error);
        notifyError(`Không thể mở cuộc trò chuyện với ${friendTarget.displayName}`);
      }
    }
  };

  const handleAccept = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!onAcceptFriend || isLoading) return;

    setIsLoading(true);
    try {
      await onAcceptFriend(friend.userId);
      notifySuccess(`Đã chấp nhận lời mời của ${friend.displayName}`);
    } catch (error) {
      friendRequestErrors.accept(error);
      notifyError(`Không thể chấp nhận lời mời của ${friend.displayName}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!onRejectFriend || isLoading) return;

    setIsLoading(true);
    try {
      await onRejectFriend(friend.userId);
      notifySuccess(`Đã từ chối lời mời của ${friend.displayName}`);
    } catch (error) {
      friendRequestErrors.reject(error);
      notifyError(`Không thể từ chối lời mời của ${friend.displayName}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3 rounded-lg hover:bg-accent cursor-pointer transition",
        isLoading && "opacity-70",
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="relative">
          <Avatar className="h-12 w-12">
            <AvatarImage src={friend.avatarUrl} alt={friend.displayName} />
            <AvatarFallback>{friend.displayName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <StatusDot
            status={friendStatus}
            isOnline={isFriendOnline}
            size="sm"
            className="absolute -bottom-0.5 -right-0.5 border-2 border-card"
          />
        </div>

        <div className="min-w-0">
          <div className="font-semibold truncate">{friend.displayName}</div>
          <div className="text-xs text-muted-foreground truncate">@{friend.userName}</div>
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
              onClick={(event) => {
                event.stopPropagation();
                void openChatWithFriend(friend);
              }}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="More options" onClick={(event) => event.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </>
        ) : hasPendingRequest ? (
          <>
            <Button onClick={handleAccept} disabled={isLoading} size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700" title="Accept">
              <Check className="h-4 w-4" />
            </Button>
            <Button onClick={handleReject} disabled={isLoading} variant="destructive" size="icon" className="h-8 w-8" title="Reject">
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : isSentRequest ? (
          <>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> Pending
            </Badge>
            <Button onClick={handleReject} disabled={isLoading} variant="ghost" size="icon" className="h-8 w-8" title="Cancel request">
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button onClick={handleAddFriend} disabled={isLoading} size="sm" className="gap-1">
            <UserPlus className="h-4 w-4" /> Add Friend
          </Button>
        )}
      </div>
    </div>
  );
};

export default FriendItem;
