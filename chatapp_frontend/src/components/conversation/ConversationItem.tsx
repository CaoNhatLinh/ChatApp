import { useConversationStore } from "@/store/conversationStore";
import { usePresence } from "@/store/presenceStore";
import { StatusDot } from "@/components/presence/StatusSelector";
import type { Conversation } from "@/types/conversation";
import { Users, MessageCircle, LogOut, Trash2, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/ContextMenu";
import { useContextMenu } from "@/hooks/common/useContextMenu";
import { conversationErrors, showSuccessToast } from "@/utils/errorHandler";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface Props {
  conversation: Conversation;
  isActive?: boolean;
  onConversationSelect?: () => void;
}

export const ConversationItem = ({ conversation, onConversationSelect }: Props) => {
  const { selectedConversation, setSelectedConversation } = useConversationStore();
  const otherUserId = conversation.type === 'dm' ? conversation.otherParticipant?.userId : undefined;
  const { presence: otherPresence } = usePresence(otherUserId);
  const isOtherOnline = otherPresence?.isOnline ?? false;
  const otherStatus = otherPresence?.status ?? 'OFFLINE';
  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();
  const isActive = selectedConversation?.conversationId === conversation.conversationId;

  const handleContextMenu = (e: React.MouseEvent) => {
    const menuItems: ContextMenuItem[] = [
      {
        label: 'Mark as Read',
        icon: <MessageCircle className="w-4 h-4" />,
        onClick: () => {
          showSuccessToast('Marked as read');
        },
      },
      {
        divider: true,
        label: '',
        onClick: () => { },
      },
      {
        label: 'Conversation Settings',
        icon: <Settings className="w-4 h-4" />,
        onClick: () => {
        },
      },
      {
        label: 'Leave Conversation',
        icon: <LogOut className="w-4 h-4" />,
        danger: true,
        onClick: () => {
          try {
            showSuccessToast('Left conversation');
          } catch (error) {
            conversationErrors.leave(error);
          }
        },
      },
    ];

    if (conversation.type === 'group') {
      menuItems.push({
        label: 'Delete Conversation',
        icon: <Trash2 className="w-4 h-4" />,
        danger: true,
        onClick: () => {
        },
      });
    }

    openContextMenu(e, menuItems);
  };

  const getLastMessageInfo = () => {
    if (!conversation.lastMessage) {
      return {
        content: "No messages yet",
        time: "",
        hasMessage: false
      };
    }

    const { content, createdAt } = conversation.lastMessage;
    const time = new Date(createdAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    return {
      content: content || "No content",
      time,
      hasMessage: true
    };
  };

  const lastMessageInfo = getLastMessageInfo();

  const getDisplayName = (conversation: Conversation) => {
    return conversation.name;
  };

  const displayName = getDisplayName(conversation);

  const getAvatarInfo = (conversation: Conversation) => {
    if (conversation.type === 'dm' && conversation.otherParticipant) {
      return {
        text: conversation.otherParticipant.displayName?.[0] || conversation.otherParticipant.username[0],
        avatarUrl: conversation.otherParticipant.avatarUrl
      };
    }
    return {
      text: conversation.name[0],
      avatarUrl: null
    };
  };

  const avatarInfo = getAvatarInfo(conversation);

  return (
    <>
      <div
        onClick={() => {
          setSelectedConversation(conversation);
          onConversationSelect?.();
        }}
        onContextMenu={handleContextMenu}
        className={cn(
          "group relative flex items-center gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer",
          isActive
            ? "bg-blue-600 text-white dark:bg-blue-400 dark:text-gray-900 shadow-md"
            : "text-gray-900 dark:text-gray-50 hover:bg-gray-100 dark:hover:bg-gray-800"
        )}
      >
        <div className="relative">
          <Avatar className="h-12 w-12">
            <AvatarImage src={avatarInfo.avatarUrl || undefined} alt={displayName} />
            <AvatarFallback className={cn(
              isActive
                ? "bg-white text-blue-600 dark:bg-gray-900 dark:text-blue-400"
                : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100"
            )}>
              {avatarInfo.text.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {conversation.type === 'dm' && conversation.otherParticipant && (
            <StatusDot
              status={otherStatus}
              isOnline={isOtherOnline}
              size="sm"
              className="absolute -bottom-0.5 -right-0.5 ring-2 ring-white dark:ring-gray-900"
            />
          )}
          {(conversation.type === 'group' || conversation.type === 'channel') && (
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
              <Users className={cn(
                "w-3 h-3",
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-700 dark:text-gray-300"
              )} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className={cn(
              "font-medium truncate",
              isActive
                ? ""
                : "text-gray-900 dark:text-gray-50"
            )}>
              {displayName}
            </h3>
            {lastMessageInfo.hasMessage && (
              <span className={cn(
                "text-xs flex-shrink-0 ml-2",
                isActive
                  ? "opacity-90"
                  : "text-gray-500 dark:text-gray-400"
              )}>
                {lastMessageInfo.time}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <p className={cn(
              "text-sm truncate flex-1",
              isActive
                ? "opacity-90"
                : "text-gray-500 dark:text-gray-400"
            )}>
              {lastMessageInfo.content}
            </p>
            {(conversation.type === 'group' || conversation.type === 'channel') && conversation.memberCount && (
              <Badge variant={isActive ? "secondary" : "outline"} className="text-xs">
                {conversation.memberCount}
              </Badge>
            )}
          </div>
        </div>

        {isActive && (
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-white dark:bg-gray-900 rounded-r-full" />
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={closeContextMenu}
        />
      )}
    </>
  );
};