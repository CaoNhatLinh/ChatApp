import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMessenger } from "@/features/messenger/model/useMessenger";
import { checkPendingUploadReceipts } from "@/features/messenger/model/checkPendingUploadReceipts";
import { inspectMediaUpload } from "@/features/messenger/api/messenger.api";
import {
  EMPTY_MESSAGES,
  useMessengerStore,
} from "@/features/messenger/model/messenger.store";
import { usePresence } from "@/features/presence/model/presence.store";
import { MessageHistory } from "./components/MessageHistory";
import { MessagePinSync } from './components/MessagePinSync';
import { useChatScroll } from './model/useChatScroll';
import { SharedContentDialog } from './components/SharedContentDialog';
import { MessageThreadDialog } from '@/features/messenger/components/Thread/MessageThreadDialog';
import { ForwardMessageDialog } from '@/features/messenger/components/Forward/ForwardMessageDialog';
import { ForwardSourceDialog } from '@/features/messenger/components/Forward/ForwardSourceDialog';
import type { MessageKey } from '@/features/messenger/api/thread.api';
import { useReadTracking } from './model/useReadTracking';
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
import { MessageSearchDialog } from "./components/MessageSearchDialog";
import { MessageReadReceiptDialog } from "./components/MessageReadReceiptDialog";
import { ChatWindowPlaceholder } from "./components/ChatWindowPlaceholder";
import { ChatWindowToast } from "./components/ChatWindowToast";
import { RoomThemePanel } from "./components/RoomThemePanel";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";
import { useWebRtcCall } from "@/features/calls/hooks/useWebRtcCall";
import { CallSessionPanel } from "./components/CallSessionPanel";
import { CallHistoryDialog } from '@/features/calls/ui/CallHistoryDialog';
import { localizeText } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { getSessionGeneration } from '@/shared/auth/access-token';
import { logger } from '@/shared/lib/logger';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Button } from '@/shared/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog';

import type { SafeRevision } from "@/widgets/chat-window/components/types";
import type { MessageRevision } from "@/features/messenger/types/messenger.types";

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

const mapMessageHistory = (history: MessageRevision[]): SafeRevision[] => history.map(({ revisionNumber, editedAt, content }) => ({
  revisionNumber,
  editedAt,
  content,
}));

export const ChatWindow = () => {
  const [isSharedContentOpen, setIsSharedContentOpen] = useState(false);
  const [callHistoryRoom, setCallHistoryRoom] = useState<string | null>(null);
  const [threadTarget, setThreadTarget] = useState<MessageKey | null>(null);
  const [forwardDialog, setForwardDialog] = useState<{ kind: 'send' | 'source'; scope: MessageKey } | null>(null);
  const [sharedContentRoom, setSharedContentRoom] = useState<string | null>(null);
  const {
    conversations,
    activeConversationId,
    loadInitialMessages,
    loadMoreMessages,
    loading,
    sendMessage,
    deleteMessage,
    pinMessage,
    loadMessageRevisions,
    loadMessageReadReceipts,
  } = useMessenger();

  const deleteMessageAction = deleteMessage;
  const pinMessageAction = pinMessage;
  const loadMessageRevisionsAction = loadMessageRevisions;
  const loadMessageReadReceiptsAction = loadMessageReadReceipts;

  const messages = useMessengerStore(
    useShallow((state) =>
      activeConversationId && !state.unavailableMessageHistory[activeConversationId]
        ? state.messages[activeConversationId] || EMPTY_MESSAGES
        : EMPTY_MESSAGES,
    ),
  );
  const hasNextMessage = useMessengerStore((state) =>
    activeConversationId ? Boolean(state.messagesPagination[activeConversationId]?.hasNext) : false,
  );
  const historyStatus = useMessengerStore((state) => state.initialMessageHistory?.conversationId === activeConversationId
    ? state.initialMessageHistory?.status : undefined);
  const historyUnavailable = useMessengerStore((state) => Boolean(activeConversationId && state.unavailableMessageHistory[activeConversationId]));
  const historyLoaded = useMessengerStore((state) => Boolean(activeConversationId && state.messagesPagination[activeConversationId]?.fetchedAt));
  const olderHistoryStatus = useMessengerStore((state) => state.olderMessageHistory?.conversationId === activeConversationId
    ? state.olderMessageHistory?.status : undefined);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const blockedUserIds = useFriendStore((state) => state.blockedUserIds);
  const fetchBlockedUsers = useFriendStore((state) => state.fetchBlockedUsers);
  const { user: currentUser } = useAuthStore();
  const retryRequests = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const requests = retryRequests.current;
    const cancelRetries = () => {
      for (const request of requests.values()) request.abort();
      requests.clear();
    };
    const unsubscribeRoom = useMessengerStore.subscribe((state, previous) => {
      if (state.activeConversationId !== previous.activeConversationId) cancelRetries();
    });
    const unsubscribeUser = useAuthStore.subscribe((state, previous) => {
      if (state.user?.userId !== previous.user?.userId) cancelRetries();
    });
    return () => {
      unsubscribeRoom();
      unsubscribeUser();
      cancelRetries();
    };
  }, []);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const infoPanelRef = useRef<HTMLDivElement>(null);
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [readReceiptsMessage, setReadReceiptsMessage] = useState<Message | null>(null);
  const [isRoomThemeOpen, setIsRoomThemeOpen] = useState(false);
  const [messageHistory, setMessageHistory] = useState<SafeRevision[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<
    UserProfile | undefined
  >();
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<Message | null>(null);
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState<Message | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);
  const messageScope = useRef(0);
  const revisionRequest = useRef(0);
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
  const historyScroll = useChatScroll(messagesRef, activeConversationId, messages, currentUser?.userId);
  const readableMessages = useMemo(() => messages.filter(message => !message.senderBlockedByViewer && !blockedUserIds.has(message.sender.userId)), [messages, blockedUserIds]);
  const readTracking = useReadTracking(historyUnavailable ? null : activeConversationId, currentUser?.userId, readableMessages, hasNextMessage, messagesRef,
    !(threadTarget && currentUser && threadTarget.conversationId === activeConversationId) && !forwardDialog && !isSharedContentOpen);

  useTrackPresence(trackIds, activeConversationId);

  useEffect(() => {
    if (currentUser?.userId) {
      void fetchBlockedUsers();
    }
  }, [currentUser?.userId, fetchBlockedUsers]);

  useLayoutEffect(() => {
    setReplyingTo(null);
    setThreadTarget(null);
    setCallHistoryRoom(null);
    setForwardDialog(null);
    setIsSharedContentOpen(false);
    setSharedContentRoom(null);
    setEditingMessage(null);
    setIsMessageSearchOpen(false);
    setIsHistoryOpen(false);
    setMessageHistory([]);
    setReadReceiptsMessage(null);
    setReportingMessage(null);
    setPendingDeleteMessage(null);
    setIsDeletingMessage(false);
    return () => { messageScope.current += 1; };
  }, [activeConversationId, currentUser?.userId, historyUnavailable]);

  useEffect(() => {
    if (!isInfoOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    infoPanelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handlePanelKey = (event: KeyboardEvent) => {
      const panel = infoPanelRef.current;
      if (event.defaultPrevented || !panel?.contains(document.activeElement)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsInfoOpen(false);
      }
      if (event.key !== 'Tab' || window.matchMedia('(min-width: 1024px)').matches) return;
      const controls = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'))
        .filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (first && last && ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', handlePanelKey);
    return () => {
      document.removeEventListener('keydown', handlePanelKey);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isInfoOpen]);

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const retryMessage = async (messageId: string): Promise<'unconfirmed' | void> => {
    const conversationId = activeConversationId;
    const userId = currentUser?.userId;
    const generation = getSessionGeneration();
    const requests = retryRequests.current;
    if (!conversationId || !userId || requests.has(messageId)) return;

    const getRoomMessages = () => useMessengerStore.getState().messages[conversationId] ?? EMPTY_MESSAGES;
    const getCurrentMessage = () => getRoomMessages().find(message => message.messageId === messageId);
    const failed = getCurrentMessage();
    const pendingSend = failed?.pendingSend;
    if (failed?.status !== 'failed' || failed.sender.userId !== userId || failed.retryAttachmentUnavailable
      || pendingSend?.conversationId !== conversationId) return;

    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted && generation === getSessionGeneration()
      && useAuthStore.getState().user?.userId === userId
      && useMessengerStore.getState().activeConversationId === conversationId;
    const isConfirmed = () => getRoomMessages().some(message => !message.messageId.startsWith('temp-')
      && message.sender.userId === userId && message.clientMessageId === pendingSend.clientMessageId);
    if (!isCurrent() || isConfirmed()) return;
    requests.set(messageId, controller);

    try {
      if (failed.retryNeedsAttachmentCheck) {
        const result = await checkPendingUploadReceipts(
          pendingSend, failed.pendingUploadIds ?? [], inspectMediaUpload, controller.signal,
        );
        if (!isCurrent() || isConfirmed() || getCurrentMessage()?.pendingSend !== pendingSend) return;
        if (result === 'unavailable') {
          useMessengerStore.getState().updateMessageStatus(conversationId, messageId, 'failed', {
            retryNeedsAttachmentCheck: false,
            retryAttachmentUnavailable: true,
          });
          return;
        }
        if (result === 'unconfirmed') return 'unconfirmed';
      }

      await sendMessage(pendingSend.content, pendingSend.type, {
        ...pendingSend,
        uploadIds: failed.pendingUploadIds,
      });
    } catch (error: unknown) {
      if (!isCurrent()) return;
      logger.error('[ChatWindow] Message retry failed', error instanceof Error ? error.message : String(error));
      showToast(getUserFacingErrorMessage(error, MESSENGER_COPY.messageInput.actionSuccess.sendFailure));
    } finally {
      if (requests.get(messageId) === controller) requests.delete(messageId);
    }
  };

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

  const captureMessageScope = useCallback((conversationId: string) => {
    const scope = messageScope.current;
    const generation = getSessionGeneration();
    return () => {
      const state = useMessengerStore.getState();
      return scope === messageScope.current && generation === getSessionGeneration()
        && state.activeConversationId === conversationId && !state.unavailableMessageHistory[conversationId];
    };
  }, []);

  const jumpToMessage = useCallback(
    async (messageId: string) => {
      const targetConversationId = activeConversationId;
      if (!targetConversationId) return;
      const isCurrent = captureMessageScope(targetConversationId);
      if (!isCurrent()) return;

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
        if (!isCurrent()) return;

        const pagination = useMessengerStore.getState().messagesPagination[targetConversationId];
        if (!pagination?.hasNext) {
          break;
        }

        if (!await loadMoreMessages(targetConversationId)) return;
        await new Promise<void>((resolve) => setTimeout(resolve, WAIT_MESSAGE_LOAD_MS));

        if (!isCurrent()) return;

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
      captureMessageScope,
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
      logger.error('[ChatWindow] Failed to jump to message from URL', error instanceof Error ? error.message : String(error));
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
      logger.error("[ChatWindow] Failed to fetch user profile", error instanceof Error ? error.message : String(error));
      showToast(getUserFacingErrorMessage(error, localizeText("Không thể tải thông tin người dùng.")));
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handleMessageAction = useCallback(
    async (action: string, message: Message) => {
      const isCurrent = captureMessageScope(message.conversationId);
      if (!isCurrent()) return;
      const request = action === 'view-history' ? ++revisionRequest.current : null;
      try {
        switch (action) {
          case "reply":
            if (!message.messageBucket) return;
            setEditingMessage(null);
            setReplyingTo(message);
            return;
          case "thread":
            if (message.messageBucket) setThreadTarget({ conversationId: message.conversationId, messageId: message.messageId, messageBucket: message.messageBucket });
            return;
          case "forward":
          case "forward-source":
            if (message.messageBucket) setForwardDialog({ kind: action === 'forward' ? 'send' : 'source', scope: {
              conversationId: message.conversationId, messageId: message.messageId, messageBucket: message.messageBucket,
            } });
            return;
          case "copy":
            await navigator.clipboard.writeText(message.content);
            if (isCurrent()) showToast(MESSENGER_COPY.chatWindow.messageAction.copySuccess);
            return;
          case "edit":
            setReplyingTo(null);
            setEditingMessage(message);
            return;
          case "delete":
            setPendingDeleteMessage(message);
            return;
          case "pin":
            await pinMessageAction(message.messageId);
            if (isCurrent()) showToast(message.isPinned
              ? MESSENGER_COPY.chatWindow.messageAction.unpinSuccess
              : MESSENGER_COPY.chatWindow.messageAction.pinSuccess);
            return;
          case "report":
            setReportingMessage(message);
            return;
          case "view-history": {
            const revisions = await loadMessageRevisionsAction(message.messageId);
            if (!isCurrent() || request !== revisionRequest.current) return;
            setMessageHistory(mapMessageHistory(revisions));
            setIsHistoryOpen(true);
            return;
          }
          case "view-seen": {
            setReadReceiptsMessage(message);
            return;
          }
          case "jump-reply":
            if (message.replyTo?.messageId && message.replyTo.messageBucket) {
              setThreadTarget({ conversationId: message.conversationId, messageId: message.replyTo.messageId, messageBucket: message.replyTo.messageBucket });
            } else {
              showToast(MESSENGER_COPY.chatWindow.messageAction.noReplyTarget);
            }
            return;
          default:
            throw new Error(`Unsupported message action: ${action}`);
        }
      } catch (error) {
        if (!isCurrent() || (request !== null && request !== revisionRequest.current)) return;
        logger.error(`[ChatWindow] Message action failed: ${action}`, error instanceof Error ? error.message : String(error));
        showToast(getUserFacingErrorMessage(error, MESSENGER_COPY.chatWindow.messageAction.actionFailed));
      }
    },
    [
      captureMessageScope,
      loadMessageRevisionsAction,
      pinMessageAction,
      showToast,
    ],
  );

  const confirmDeleteMessage = useCallback(async () => {
    if (!pendingDeleteMessage) return;
    const isCurrent = captureMessageScope(pendingDeleteMessage.conversationId);
    if (!isCurrent()) return;
    setIsDeletingMessage(true);
    try {
      await deleteMessageAction(pendingDeleteMessage.messageId);
      if (!isCurrent()) return;
      setEditingMessage((current) =>
        current?.messageId === pendingDeleteMessage.messageId ? null : current,
      );
      setPendingDeleteMessage(null);
      showToast(MESSENGER_COPY.chatWindow.messageAction.deleteSuccess);
    } catch (error) {
      if (!isCurrent()) return;
      logger.error('[ChatWindow] Message delete failed', error instanceof Error ? error.message : String(error));
      showToast(getUserFacingErrorMessage(error, MESSENGER_COPY.chatWindow.messageAction.actionFailed));
    } finally {
      if (isCurrent()) setIsDeletingMessage(false);
    }
  }, [captureMessageScope, deleteMessageAction, pendingDeleteMessage, showToast]);

  const closeProfileModal = () => {
    setIsProfileModalOpen(false);
  };

  const otherStatusLabel = activeConversation?.type === "dm" && otherPresence
      ? `${
          otherPresence.status === "DND"
            ? MESSENGER_COPY.chatWindow.status.dnd
            : otherPresence.isOnline
              ? MESSENGER_COPY.chatWindow.status.online
              : MESSENGER_COPY.chatWindow.status.offline
        }${otherPresence.device ? `${MESSENGER_COPY.presence.deviceSeparator}${formatPresenceDevice(otherPresence.device)}` : ""}`
      : null;

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
      className={`messenger-conversation relative flex h-full min-w-0 flex-1 overflow-hidden ${isInfoOpen ? 'z-50 lg:z-10' : 'z-10'}`}
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.fadeIn}
    >
      <div className="flex h-full min-w-0 flex-1 flex-col transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-300">
        <ConversationHeader
          conversation={activeConversation}
          isInfoOpen={isInfoOpen}
          isOtherOnline={otherPresence?.isOnline ?? null}
          otherStatusLabel={otherStatusLabel}
          onSearch={() => setIsMessageSearchOpen(true)}
          onVideoCall={() => startCall("VIDEO")}
          onVoiceCall={() => startCall("VOICE")}
          onOpenCallHistory={() => setCallHistoryRoom(activeConversation.conversationId)}
          canCall={canCall}
          callDisabled={!callControls.canStart}
          onToggleInfo={() => setIsInfoOpen((current) => !current)}
        />

        <MessagePinSync key={`${currentUser?.userId}:${activeConversation.conversationId}`} conversationId={activeConversation.conversationId} />
        {callHistoryRoom && callHistoryRoom === activeConversationId ? <CallHistoryDialog conversationId={callHistoryRoom} onClose={() => setCallHistoryRoom(null)} /> : null}

        <MessageSearchDialog
          isOpen={isMessageSearchOpen}
          conversationId={activeConversation.conversationId}
          conversationName={activeConversation.name}
          onClose={() => setIsMessageSearchOpen(false)}
          onSelectMessage={(messageId) => void jumpToMessage(messageId)}
        />
        {threadTarget && currentUser && threadTarget.conversationId === activeConversationId ? <MessageThreadDialog
          key={`${currentUser.userId}:${threadTarget.conversationId}:${threadTarget.messageBucket}:${threadTarget.messageId}`}
          scope={threadTarget} roomVisual={roomThemeSettings.computed} onClose={() => setThreadTarget(null)}
          onComposeMain={parent => { setEditingMessage(null); setReplyingTo(parent); setThreadTarget(null); }}
          onOpenLibrary={() => { setThreadTarget(null); setIsSharedContentOpen(true); }} /> : null}
        {forwardDialog && currentUser && forwardDialog.scope.conversationId === activeConversationId ? forwardDialog.kind === 'send' ? <ForwardMessageDialog
          key={`send:${currentUser.userId}:${forwardDialog.scope.conversationId}:${forwardDialog.scope.messageBucket}:${forwardDialog.scope.messageId}`}
          scope={forwardDialog.scope} actorId={currentUser.userId} onClose={() => setForwardDialog(null)}
          onOpenLibrary={room => { setForwardDialog(null); setSharedContentRoom(room); setIsSharedContentOpen(true); }} /> : <ForwardSourceDialog
          key={`source:${currentUser.userId}:${forwardDialog.scope.conversationId}:${forwardDialog.scope.messageBucket}:${forwardDialog.scope.messageId}`}
          scope={forwardDialog.scope} onClose={() => setForwardDialog(null)}
          onOpenLibrary={room => { setForwardDialog(null); setSharedContentRoom(room); setIsSharedContentOpen(true); }} /> : null}

        <Dialog open={isRoomThemeOpen} onOpenChange={setIsRoomThemeOpen}>
          <DialogContent className="room-theme-dialog messenger-workspace overflow-y-auto border border-border/65 bg-background/95 p-0 sm:max-h-[calc(100dvh-2rem)] sm:max-w-5xl sm:rounded-[var(--radius-lg)]">
            <DialogHeader className="sr-only">
              <DialogTitle>{localizeText('Tùy chỉnh giao diện cá nhân')}</DialogTitle>
              <DialogDescription>{localizeText('Tùy chỉnh này chỉ hiển thị với bạn.')}</DialogDescription>
            </DialogHeader>
            <RoomThemePanel
              key={activeConversationId}
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
              activeBackgroundTreatment={roomThemeSettings.activeConversationBackgroundTreatment}
              hasConversationOverride={roomThemeSettings.hasConversationOverride}
              onSave={roomThemeSettings.saveAppearance}
              onSaved={() => setIsRoomThemeOpen(false)}
            />
          </DialogContent>
        </Dialog>
        <CallSessionPanel controls={callControls} />

        <div className="relative flex min-h-0 flex-1 flex-col">
        {readTracking.error ? <div role="status" className="flex items-center justify-between gap-2 bg-muted px-4 py-2 text-xs text-foreground">
          {localizeText('Chưa đồng bộ trạng thái đọc.')}<Button size="sm" variant="ghost" onClick={readTracking.retry}>{localizeText('Thử lại')}</Button>
        </div> : null}
        {historyStatus === 'error' ? <div className="flex items-center justify-between gap-2 bg-muted px-4 py-2 text-sm text-foreground">
          <p role="alert">{localizeText(historyUnavailable ? 'Bạn hiện không xem được tin nhắn ở đây.' : MESSENGER_COPY.errors.loadMessagesFailed)}</p>
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => {
            messagesRef.current?.focus({ preventScroll: true });
            void loadInitialMessages(activeConversation.conversationId);
          }}>
            {localizeText('Tải lại tin nhắn')}
          </Button>
        </div> : null}
        <MessageHistory
          activeConversationId={activeConversationId}
          messages={messages}
          unreadMessageId={readTracking.messageId}
          unreadAbove={readTracking.above}
          roomVisual={roomThemeSettings.computed}
          blockedUserIds={blockedUserIds}
          loading={loading || historyStatus === 'loading'}
          initialState={historyStatus === 'loading' ? 'loading' : historyLoaded && !historyStatus ? 'loaded' : undefined}
          paginationState={olderHistoryStatus}
          hasNext={hasNextMessage && !historyUnavailable}
          scrollRef={messagesRef}
          onScroll={historyScroll.onScroll}
          highlightMessageId={highlightMessageId}
          onLoadMore={() =>
            activeConversationId && void loadMoreMessages(activeConversationId)
          }
          onAction={handleMessageAction}
          onUserClick={handleUserClick}
          onRetry={retryMessage}
        />

        {historyScroll.hasNewMessages ? (
          <Button type="button" variant="secondary" className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap shadow-md" onClick={historyScroll.scrollToLatest}>
            {localizeText('Có tin nhắn mới · Về cuối')}
          </Button>
        ) : null}
        </div>
        {!historyUnavailable ? <div className="chat-composer-dock p-4 pb-20 sm:p-6 md:pb-6">
          <MessageInput
            key={`${currentUser?.userId ?? 'anonymous'}:${activeConversationId}`}
            replyingTo={replyingTo}
            editingMessage={editingMessage}
            onCancelReply={() => setReplyingTo(current => current?.messageId === replyingTo?.messageId && current?.conversationId === replyingTo?.conversationId ? null : current)}
            onCancelEdit={() => setEditingMessage(null)}
            onStartCall={startCall}
            canStartCall={canCall && callControls.canStart}
          />
        </div> : null}
      </div>

      {selectedUserId ? <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          userId={selectedUserId}
          presenceConversationId={activeConversationId}
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
        onSubmitted={() => showToast(localizeText("Đã gửi báo cáo. Cảm ơn bạn đã giúp giữ Nối an toàn."))}
      />

      {isInfoOpen ? <div
        ref={infoPanelRef}
        role="dialog"
        aria-label={localizeText('Thông tin cuộc trò chuyện')}
        data-open={isInfoOpen ? "true" : undefined}
        className={`conversation-info-drawer fixed inset-0 z-30 h-full transition-transform duration-300 lg:static lg:inset-auto lg:z-auto lg:w-[286px] lg:shrink-0 lg:translate-x-0 ${
          isInfoOpen ? "z-50 translate-x-0" : "translate-x-full"
        }`}
      >
        <ConversationInfo
          isOpen={isInfoOpen}
          onClose={() => setIsInfoOpen(false)}
          onOpenAppearance={() => {
            setIsInfoOpen(false);
            setIsRoomThemeOpen(true);
          }}
          onOpenSharedContent={() => {
            setIsInfoOpen(false);
            setIsSharedContentOpen(true);
          }}
        />
      </div> : null}

      {activeConversationId ? <SharedContentDialog key={sharedContentRoom ?? activeConversationId} conversationId={sharedContentRoom ?? activeConversationId} open={isSharedContentOpen}
        onOpenChange={open => { setIsSharedContentOpen(open); if (!open) setSharedContentRoom(null); }} /> : null}
      {toastMessage ? <ChatWindowToast message={toastMessage} /> : null}

      <MessageRevisionPanel
        isOpen={isHistoryOpen}
        revisions={messageHistory}
        onOpenChange={setIsHistoryOpen}
      />

      <MessageReadReceiptDialog
        isOpen={readReceiptsMessage !== null}
        message={readReceiptsMessage}
        onOpenChange={(open) => {
          if (!open) setReadReceiptsMessage(null);
        }}
        loadPage={loadMessageReadReceiptsAction}
      />

      <ConfirmDialog
        open={pendingDeleteMessage !== null}
        onOpenChange={(open) => { if (!open && !isDeletingMessage) setPendingDeleteMessage(null); }}
        title={MESSENGER_COPY.message.deleteLabel}
        description={localizeText('Tin nhắn sẽ bị xóa khỏi cuộc trò chuyện. Bạn không thể hoàn tác thao tác này.')}
        confirmLabel={localizeText('Xóa')}
        destructive
        loading={isDeletingMessage}
        onConfirm={confirmDeleteMessage}
      />
    </motion.div>
  );
};

export default ChatWindow;

