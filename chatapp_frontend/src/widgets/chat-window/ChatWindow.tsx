import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMessenger } from "@/features/messenger/model/useMessenger";
import {
  EMPTY_MESSAGES,
  useMessengerStore,
} from "@/features/messenger/model/messenger.store";
import { usePresence } from "@/features/presence/model/presence.store";
import { MessageHistory } from "./components/MessageHistory";
import { MessageRevisionPanel } from "./components/MessageRevisionPanel";
import { ReportMessageModal } from "@/features/messenger/components/chat/ReportMessageModal";
import { ConversationInfo } from "@/features/messenger/components/chat/ConversationInfo";
import { MessageInput } from "@/features/messenger/components/MessageInput/MessageInput";
import { useRoomThemeState } from "@/features/settings/model/useRoomThemeState";
import type {
  Conversation,
  Message,
} from "@/features/messenger/types/messenger.types";
import { useFriendStore } from "@/features/relationships/model/friend.store";
import { useAuthStore } from "@/features/auth/model/auth.store";
import type { UserProfileModal as UserProfile } from "@/shared/types/room.types";
import type { UserDTO } from "@/entities/user/model/user.types";
import { UserProfileModal } from "@/features/profile/components/user/UserProfileModal";
import { useTrackPresence } from "@/features/presence/hooks/useTrackPresence";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import apiClient from "@/shared/api/apiClient";
import { ConversationHeader } from "./components/ConversationHeader";
import { ChatWindowPlaceholder } from "./components/ChatWindowPlaceholder";
import { ChatWindowToast } from "./components/ChatWindowToast";
import { RoomThemePanel } from "./components/RoomThemePanel";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";
import { useWebRtcCall } from "@/features/calls/hooks/useWebRtcCall";
import { CallSessionPanel } from "./components/CallSessionPanel";
import { getLocale, localizeText } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { logger } from '@/shared/lib/logger';

import type { SafeRevision } from "@/widgets/chat-window/components/types";
import type { MessageReadReceipt, MessageRevision } from "@/features/messenger/types/messenger.types";

const WAIT_MESSAGE_LOAD_MS = 80;
const MAX_MESSAGE_JUMP_ATTEMPTS = 20;

const mapUserProfile = (profile: UserDTO): UserProfile => ({
  userId: profile.userId,
  username: profile.userName,
  displayName: profile.displayName,
  avatarUrl: profile.avatarUrl,
  joinedAt: profile.createdAt,
  lastSeen: profile.lastActive ?? undefined,
});

const formatPresenceDevice = (device?: string): string => {
  if (!device) return "";
  if (device.includes(MESSENGER_COPY.presence.deviceSeparator)) return device;
  return device.length > 40 ? `${device.slice(0, 40)}...` : device;
};

const fetchUserProfile = async (userId: string): Promise<UserDTO> => {
  const response = await apiClient.get<{
    userId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    accountStatus: string;
  }>(`/users/${userId}`);
  return {
    userId: response.data.userId,
    userName: response.data.username,
    displayName: response.data.displayName,
    avatarUrl: response.data.avatarUrl,
    status: response.data.accountStatus,
  };
};

const latestReadReceipt = (message: Message): MessageReadReceipt | undefined => (
  [...(message.readReceipts ?? [])].sort(
    (left, right) =>
      new Date(right.readAt).getTime() - new Date(left.readAt).getTime(),
  )[0]
);

const mapMessageHistory = (history: MessageRevision[]): SafeRevision[] => history.map(({ revisionNumber, editedAt, content }) => ({
  revisionNumber,
  editedAt,
  content,
}));

export const ChatWindow = () => {
  const {
    conversations,
    activeConversationId,
    setSidebarOpen,
    loadMoreMessages,
    loading,
    typingUsers,
    sendMessage,
    deleteMessage,
    pinMessage,
    loadMessageRevisions,
  } = useMessenger();

  const deleteMessageAction = deleteMessage;
  const pinMessageAction = pinMessage;
  const loadMessageRevisionsAction = loadMessageRevisions;

  const messages = useMessengerStore(
    useShallow((state) =>
      activeConversationId
        ? state.messages[activeConversationId] || EMPTY_MESSAGES
        : EMPTY_MESSAGES,
    ),
  );
  const hasNextMessage = useMessengerStore((state) =>
    activeConversationId ? Boolean(state.messagesPagination[activeConversationId]?.hasNext) : false,
  );
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const blockedUserIds = useFriendStore((state) => state.blockedUserIds);
  const fetchBlockedUsers = useFriendStore((state) => state.fetchBlockedUsers);
  const { user: currentUser } = useAuthStore();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isRoomThemeOpen, setIsRoomThemeOpen] = useState(false);
  const [messageHistory, setMessageHistory] = useState<SafeRevision[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<
    UserProfile | undefined
  >();
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<Message | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const messageIdFromQuery = searchParams.get("messageId");

  const activeConversation = useMemo(
    () =>
      conversations?.find(
        (conversation: Conversation) =>
          conversation.conversationId === activeConversationId,
      ),
    [conversations, activeConversationId],
  );

  const otherUserId =
    activeConversation?.type === "dm"
      ? activeConversation.otherParticipant?.userId
      : undefined;

  const trackIds = useMemo(
    () => (otherUserId ? [otherUserId] : []),
    [otherUserId],
  );

  const { presence: otherPresence } = usePresence(otherUserId);
  const isOtherOnline = otherPresence?.isOnline ?? false;
  const otherStatus = otherPresence?.status ?? "OFFLINE";
  const roomThemeSettings = useRoomThemeState(activeConversationId, currentUser?.userId ?? null);
  const canCall = activeConversation?.type === "dm" && Boolean(otherUserId);
  const callControls = useWebRtcCall({
    conversationId: activeConversationId,
    currentUserId: currentUser?.userId,
    peerUserId: otherUserId,
    peerDisplayName: activeConversation?.otherParticipant?.displayName ?? activeConversation?.name ?? "",
    canCall,
  });
  const startCallControl = callControls.start;

  const messagesRef = useRef<HTMLDivElement>(null);
  const lastMessageId =
    messages.length > 0 ? messages[messages.length - 1].messageId : null;

  useTrackPresence(trackIds);

  useEffect(() => {
    if (currentUser?.userId) {
      void fetchBlockedUsers();
    }
  }, [currentUser?.userId, fetchBlockedUsers]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTo({
        top: messagesRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [lastMessageId, typingUsers]);

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const startCall = useCallback((callType: "VOICE" | "VIDEO") => {
    void startCallControl(callType);
  }, [startCallControl]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const scrollToMessage = useCallback((messageId: string): boolean => {
    const container = messagesRef.current;
    if (!container) return false;

    const selector = `[data-message-id="${messageId}"]`;
    const target = container.querySelector<HTMLElement>(selector);
    if (!target) return false;

    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    return true;
  }, []);

  const jumpToMessage = useCallback(
    async (messageId: string) => {
      const targetConversationId = activeConversationId;
      if (!targetConversationId) return;

      if (scrollToMessage(messageId)) {
        setHighlightMessageId(messageId);
        const params = new URLSearchParams(searchParams);
        params.set("conversationId", targetConversationId);
        params.set("messageId", messageId);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        return;
      }

      let attempts = 0;
      while (attempts < MAX_MESSAGE_JUMP_ATTEMPTS) {
        if (targetConversationId !== activeConversationId) return;

        const pagination = useMessengerStore.getState().messagesPagination[targetConversationId];
        if (!pagination?.hasNext) {
          break;
        }

        await loadMoreMessages(targetConversationId);
        await new Promise<void>((resolve) => setTimeout(resolve, WAIT_MESSAGE_LOAD_MS));

        if (targetConversationId !== activeConversationId) return;

        if (scrollToMessage(messageId)) {
          setHighlightMessageId(messageId);
          const params = new URLSearchParams(searchParams);
          params.set("conversationId", targetConversationId);
          params.set("messageId", messageId);
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
          return;
        }

        attempts += 1;
      }

      if (!scrollToMessage(messageId)) {
        setHighlightMessageId(null);
        showToast(MESSENGER_COPY.chatWindow.messageAction.noMessageFoundInHistory);
      }
    },
    [
      activeConversationId,
      loadMoreMessages,
      scrollToMessage,
      searchParams,
      pathname,
      router,
      showToast,
    ],
  );

  useEffect(() => {
    if (!messageIdFromQuery) {
      setHighlightMessageId(null);
      return;
    }
    void jumpToMessage(messageIdFromQuery).catch((error: unknown) => {
      logger.error('[ChatWindow] Failed to jump to message from URL:', error);
      showToast(getUserFacingErrorMessage(error, MESSENGER_COPY.chatWindow.messageAction.actionFailed));
    });
  }, [activeConversationId, jumpToMessage, messageIdFromQuery, showToast]);

  const handleUserClick = async (userId: string) => {
    setSelectedUserId(userId);
    setIsProfileModalOpen(true);
    setIsProfileLoading(true);
    setSelectedUserProfile(undefined);

    try {
      const profile = await fetchUserProfile(userId);
      setSelectedUserProfile(mapUserProfile(profile));
    } catch (error) {
      logger.error("[ChatWindow] Failed to fetch user profile:", error);
      showToast(getUserFacingErrorMessage(error, localizeText("Không thể tải thông tin người dùng.")));
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handleMessageAction = useCallback(
    async (action: string, message: Message) => {
      try {
        switch (action) {
          case "reply":
            setEditingMessage(null);
            setReplyingTo(message);
            return;
          case "copy":
            await navigator.clipboard.writeText(message.content);
            showToast(MESSENGER_COPY.chatWindow.messageAction.copySuccess);
            return;
          case "edit":
            setReplyingTo(null);
            setEditingMessage(message);
            return;
          case "delete":
            await deleteMessageAction(message.messageId);
            setEditingMessage((current) =>
              current?.messageId === message.messageId ? null : current,
            );
            showToast(MESSENGER_COPY.chatWindow.messageAction.deleteSuccess);
            return;
          case "pin":
            await pinMessageAction(message.messageId);
            showToast(MESSENGER_COPY.chatWindow.messageAction.pinSuccess);
            return;
          case "report":
            setReportingMessage(message);
            return;
          case "view-history": {
            const revisions = await loadMessageRevisionsAction(message.messageId);
            setMessageHistory(mapMessageHistory(revisions));
            setIsHistoryOpen(true);
            return;
          }
          case "view-seen": {
            const latestSeen = latestReadReceipt(message);
            if (latestSeen) {
              showToast(MESSENGER_COPY.chatWindow.messageAction.seenAt(
                new Date(latestSeen.readAt).toLocaleString(getLocale() === 'en' ? 'en-US' : 'vi-VN'),
              ));
            }
            return;
          }
          case "jump-reply":
            if (message.replyTo?.messageId) {
              await jumpToMessage(message.replyTo.messageId);
            } else {
              showToast(MESSENGER_COPY.chatWindow.messageAction.noReplyTarget);
            }
            return;
          default:
            throw new Error(`Unsupported message action: ${action}`);
        }
      } catch (error) {
        logger.error(`[ChatWindow] Message action failed: ${action}`, error);
        showToast(getUserFacingErrorMessage(error, MESSENGER_COPY.chatWindow.messageAction.actionFailed));
      }
    },
    [
      deleteMessageAction,
      jumpToMessage,
      loadMessageRevisionsAction,
      pinMessageAction,
      showToast,
    ],
  );

  const closeProfileModal = () => {
    setIsProfileModalOpen(false);
  };

  const statusLabel =
    activeConversation?.type === "dm"
      ? `${
          otherStatus === "DND"
            ? MESSENGER_COPY.chatWindow.status.dnd
            : isOtherOnline
              ? MESSENGER_COPY.chatWindow.status.online
              : MESSENGER_COPY.chatWindow.status.offline
        }${otherPresence?.device ? `${MESSENGER_COPY.presence.deviceSeparator}${formatPresenceDevice(otherPresence.device)}` : ""}`
        : `${activeConversation?.memberCount ?? 0} ${MESSENGER_COPY.chatWindow.status.groupMemberSuffix}`;

  if (!activeConversation) {
    return (
      <ChatWindowPlaceholder
        title={MESSENGER_COPY.chatWindow.placeholder.emptyTitle}
        message={MESSENGER_COPY.chatWindow.placeholder.emptyMessage}
      />
    );
  }

  return (
    <motion.div
      key={activeConversation.conversationId}
      className="flex-1 h-full flex z-10 overflow-hidden relative"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.fadeIn}
    >
      <div className="flex-1 flex flex-col h-full transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-300">
        <ConversationHeader
          conversation={activeConversation}
          isInfoOpen={isInfoOpen}
          isOtherOnline={isOtherOnline}
          otherStatusLabel={statusLabel}
          canGoBack
          onBack={() => setSidebarOpen(true)}
          onSearch={() => router.push(`/search?conversationId=${activeConversationId}`)}
          onVideoCall={() => startCall("VIDEO")}
          onVoiceCall={() => startCall("VOICE")}
          canCall={canCall}
          callDisabledReason="Gọi trực tiếp hiện chỉ hỗ trợ cuộc trò chuyện 1–1."
          onOpenRoomTheme={() => setIsRoomThemeOpen((current) => !current)}
          onToggleInfo={() => setIsInfoOpen((current) => !current)}
        />

        {isRoomThemeOpen ? (
          <RoomThemePanel
            conversationId={activeConversationId}
            conversationName={
              activeConversation.type === "dm"
                ? activeConversation.otherParticipant?.displayName ?? activeConversation.name
                : activeConversation.name
            }
            defaultRoomThemeId={roomThemeSettings.settings.defaultRoomThemeId}
            defaultBubbleStyleId={roomThemeSettings.settings.messageBubbleStyle}
            activeRoomThemeId={roomThemeSettings.activeRoomThemeId}
            activeBackgroundImage={roomThemeSettings.activeConversationBackground || ""}
            hasConversationOverride={roomThemeSettings.hasConversationOverride}
            onSetDefaultRoomTheme={roomThemeSettings.setDefaultRoomTheme}
            onSetRoomTheme={(themeId) => {
              if (activeConversationId) {
                roomThemeSettings.setConversationTheme(activeConversationId, themeId);
              }
            }}
            onSetBubbleStyle={roomThemeSettings.setRoomBubbleStyle}
            onSetBackgroundImage={(backgroundUrl) => {
              if (activeConversationId) {
                roomThemeSettings.setConversationBackground(
                  activeConversationId,
                  backgroundUrl.trim(),
                );
              }
            }}
            onClearConversationTheme={() => {
              if (activeConversationId) {
                roomThemeSettings.resetConversationTheme(activeConversationId);
              }
            }}
            onClearConversationBackground={() => {
              if (activeConversationId) {
                roomThemeSettings.clearConversationBackground(activeConversationId);
              }
            }}
          />
        ) : null}

        <CallSessionPanel controls={callControls} />

        <MessageHistory
          activeConversationId={activeConversationId}
          messages={messages}
          roomVisual={roomThemeSettings.computed}
          blockedUserIds={blockedUserIds}
          loading={loading}
          hasNext={hasNextMessage}
          scrollRef={messagesRef}
          highlightMessageId={highlightMessageId}
          onLoadMore={() =>
            activeConversationId && void loadMoreMessages(activeConversationId)
          }
          onAction={handleMessageAction}
          onUserClick={handleUserClick}
          onRetry={(messageId) => {
            if (!activeConversationId) return;

            const messageToRetry = messages.find(
              (message) => message.messageId === messageId,
            );

            if (messageToRetry) {
              useMessengerStore
                .getState()
                .removeMessage(activeConversationId, messageId);
              void sendMessage(messageToRetry.content, messageToRetry.type, {
                clientMessageId:
                  messageToRetry.clientMessageId ?? crypto.randomUUID(),
                attachments: messageToRetry.attachments,
                replyToId: messageToRetry.replyTo?.messageId,
              }).catch((error: unknown) => {
                logger.error('[ChatWindow] Message retry failed', error instanceof Error ? error.message : String(error));
                showToast(getUserFacingErrorMessage(error, MESSENGER_COPY.messageInput.actionSuccess.sendFailure));
              });
            }
          }}
        />

        <div className="p-6">
          <MessageInput
            replyingTo={replyingTo}
            editingMessage={editingMessage}
            onCancelReply={() => setReplyingTo(null)}
            onCancelEdit={() => setEditingMessage(null)}
            onStartCall={startCall}
            canStartCall={canCall}
          />
        </div>
      </div>

      {selectedUserId ? <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          userId={selectedUserId}
          userProfile={selectedUserProfile}
          isLoading={isProfileLoading}
          onSendMessage={() => {
            closeProfileModal();
          }}
          onBlock={() => {
            void fetchBlockedUsers();
            setIsProfileModalOpen(false);
          }}
          onUnblock={() => {
            void fetchBlockedUsers();
          }}
          onReport={() => setIsProfileModalOpen(false)}
        /> : null}

      <ReportMessageModal
        message={reportingMessage}
        onClose={() => setReportingMessage(null)}
        onSubmitted={() => showToast(localizeText("Đã gửi báo cáo. Cảm ơn bạn đã giúp giữ NovaChat an toàn."))}
      />

      <div
        className={`absolute top-0 right-0 h-full transition-transform duration-300 ${
          isInfoOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <ConversationInfo
          isOpen={isInfoOpen}
          onClose={() => setIsInfoOpen(false)}
        />
      </div>

      {toastMessage ? <ChatWindowToast message={toastMessage} /> : null}

      <MessageRevisionPanel
        isOpen={isHistoryOpen}
        revisions={messageHistory}
        onOpenChange={setIsHistoryOpen}
      />
    </motion.div>
  );
};

export default ChatWindow;

