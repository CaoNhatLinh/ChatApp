import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import EmojiPicker, { Theme } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";
import { notifyError, notifySuccess, notifyWarning } from "@/shared/lib/notification";
import { useMessenger } from "@/features/messenger/model/useMessenger";
import { useMessengerStore } from "@/features/messenger/model/messenger.store";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { useFriendStore } from "@/features/relationships/model/friend.store";
import { Textarea } from "@/shared/ui/Textarea";
import { Button } from "@/shared/ui/Button";
import { CreatePollModal } from "../Poll/CreatePollModal";
import { friendApi } from "@/features/relationships/api/friends.api";
import { createPoll } from "../../api/poll.api";
import { getMentionQuery, insertMention } from "../../utils/mention.utils";
import { MessageInputBlockedState } from "./components/MessageInputBlockedState";
import { MessageInputDraftPanel } from "./components/MessageInputDraftPanel";
import { MessageInputToolbar } from "./components/MessageInputToolbar";
import type { Attachment, CreatePollRequest, Message } from "../../types/messenger.types";
import { MentionMenu } from "./MentionMenu";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";
import { localizeText } from "@/shared/i18n";
import { getUserFacingErrorMessage } from "@/shared/lib/user-facing-error";
import { logger } from "@/shared/lib/logger";

interface MessageInputProps {
  replyingTo?: Message | null;
  editingMessage?: Message | null;
  onCancelReply?: () => void;
  onCancelEdit?: () => void;
  onStartCall: (callType: "VOICE" | "VIDEO") => void;
  canStartCall: boolean;
}

const MAX_FILES_PER_MESSAGE = 10;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = ["image/", "video/", "audio/"];
const ALLOWED_EXACT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
]);
const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "txt",
  "csv",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "mp4",
  "avi",
  "mov",
  "wmv",
  "webm",
  "mp3",
  "wav",
  "ogg",
  "m4a",
  "aac",
]);

export const MessageInput: React.FC<MessageInputProps> = ({
  replyingTo,
  editingMessage,
  onCancelReply,
  onCancelEdit,
  onStartCall,
  canStartCall,
}) => {
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [blockStatus, setBlockStatus] = useState<{ hasBlocked: boolean; isBlockedBy: boolean } | null>(null);
  const [blockStatusLoading, setBlockStatusLoading] = useState(false);
  const [blockStatusError, setBlockStatusError] = useState(false);
  const [blockStatusRetry, setBlockStatusRetry] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isUnblocking, setIsUnblocking] = useState(false);

  const { sendMessage, sendTyping, activeConversationId, editMessage, uploadMessageFiles } = useMessenger();
  const fetchBlockedUsers = useFriendStore((state) => state.fetchBlockedUsers);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSendingRef = useRef(false);
  const conversationsFromStore = useMessengerStore((state) => state.conversations);
  const user = useAuthStore((state) => state.user);
  const unblockFriend = useFriendStore((state) => state.unblockFriend);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content);
    }
  }, [editingMessage]);

  useEffect(() => {
    if (!activeConversationId) {
      setBlockStatus(null);
      setBlockStatusLoading(false);
      setBlockStatusError(false);
      return;
    }

    const conv = conversationsFromStore.find((item) => item.conversationId === activeConversationId);
    if (conv?.type === "dm" && conv.otherParticipant?.userId) {
      let isMounted = true;
      setBlockStatus(null);
      setBlockStatusLoading(true);
      setBlockStatusError(false);
      friendApi
        .checkBlockStatus(conv.otherParticipant.userId)
        .then((status) => {
          if (isMounted) {
            setBlockStatus(status);
          }
        })
        .catch((error: unknown) => {
          if (isMounted) setBlockStatusError(true);
          logger.error("[MessageInput] Failed to check block status", error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          if (isMounted) setBlockStatusLoading(false);
        });

      return () => {
        isMounted = false;
      };
    }

    setBlockStatus(null);
    setBlockStatusLoading(false);
    setBlockStatusError(false);
  }, [activeConversationId, blockStatusRetry, conversationsFromStore]);

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = event.target.value;
    setText(nextText);
    const cursorPos = event.target.selectionStart ?? nextText.length;
    setMentionQuery(getMentionQuery(nextText, cursorPos));
  };

  const handleMentionSelect = useCallback(
    (userId: string, displayName: string) => {
      const textarea = textareaRef.current;
      const cursorPos = textarea?.selectionStart ?? text.length;
      const { newContent, newCursorPos } = insertMention(text, cursorPos, userId, displayName);

      setText(newContent);
      setMentionQuery(null);

      requestAnimationFrame(() => {
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [text],
  );

  const handleMentionClose = useCallback(() => {
    setMentionQuery(null);
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size <= 0) {
      return MESSENGER_COPY.messageInput.actionError.fileInvalid(file.name);
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return MESSENGER_COPY.messageInput.actionError.fileTooLarge(file.name);
    }

    const mimeType = (file.type || "").toLowerCase();
    const extension = file.name.includes(".")
      ? file.name.substring(file.name.lastIndexOf(".") + 1).toLowerCase()
      : "";
    const hasAllowedPrefix = ALLOWED_MEDIA_TYPES.some((prefix) => mimeType.startsWith(prefix));
    const hasAllowedType = ALLOWED_EXACT_TYPES.has(mimeType) || (extension && ALLOWED_EXTENSIONS.has(extension));

    if (!hasAllowedPrefix && !hasAllowedType) {
      return MESSENGER_COPY.messageInput.actionError.fileUnsupportedType(file.name);
    }

    return null;
  }, []);

  const buildValidFiles = useCallback((files: File[]): { validFiles: File[]; invalidMessages: string[] } => {
    const normalized = files.filter((file) => !!file && !!file.name);
    const validFiles: File[] = [];
    const invalidMessages: string[] = [];

    normalized.forEach((file) => {
      const validationError = validateFile(file);
      if (validationError) {
        invalidMessages.push(validationError);
      } else {
        validFiles.push(file);
      }
    });

    return { validFiles, invalidMessages };
  }, [validateFile]);

  useEffect(() => {
    if (text.length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        sendTyping(true);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        sendTyping(false);
      }, 2000);
      return;
    }

    if (isTypingRef.current) {
      isTypingRef.current = false;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendTyping(false);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [text, sendTyping]);

  const showSuccess = useCallback((message: string) => notifySuccess(message), []);
  const showError = (message: string) => notifyError(message);
  const showWarning = useCallback((message: string, options?: Parameters<typeof notifyWarning>[1]) => notifyWarning(message, options), []);

  const clearTypingState = useCallback(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendTyping(false);
    }
  }, [sendTyping]);

  const handleSend = useCallback(async () => {
    const hasText = text.trim().length > 0;
    const hasFiles = selectedFiles.length > 0;

    if (!hasText && !hasFiles) return;
    if (!activeConversationId) {
      showError(MESSENGER_COPY.messageInput.actionError.noConversationToSend);
      return;
    }
    if (isSendingRef.current) return;

    clearTypingState();
    setMentionQuery(null);
    setIsSending(true);
    isSendingRef.current = true;
    const trimmedText = text.trim();

    try {
      let attachments: Attachment[] = [];

      if (!editingMessage && selectedFiles.length > 0) {
        const { validFiles, invalidMessages } = buildValidFiles(selectedFiles);

        invalidMessages.forEach((error) => {
          showWarning(error);
        });

        if (validFiles.length === 0) {
          showError(MESSENGER_COPY.messageInput.actionSuccess.noValidFileToSend);
          return;
        }

        const uploadedAttachments = await uploadMessageFiles(validFiles);
        if (!uploadedAttachments || uploadedAttachments.length === 0) {
          showError(MESSENGER_COPY.messageInput.actionSuccess.uploadFailed);
          return;
        }

        if (uploadedAttachments.length < validFiles.length) {
          const rejectedCount = validFiles.length - uploadedAttachments.length;
          showError(MESSENGER_COPY.messageInput.actionSuccess.uploadShortage(rejectedCount));
        }

        attachments = uploadedAttachments;
      } else if (editingMessage && hasFiles) {
        showWarning(MESSENGER_COPY.messageInput.actionError.attachmentDisabledDuringEdit());
      }

      if (editingMessage) {
        await editMessage(editingMessage.messageId, trimmedText);
        onCancelEdit?.();
        showSuccess(MESSENGER_COPY.messageInput.actionSuccess.editSuccess);
      } else {
        const hasImageOrVideo = attachments.some((attachment) => {
          const contentType = attachment.contentType ?? attachment.mimeType ?? "";
          return contentType.startsWith("image/") || contentType.startsWith("video/");
        });
        const messageType = attachments.length > 0 ? (hasImageOrVideo ? "IMAGE" : "FILE") : "TEXT";
        await sendMessage(trimmedText, messageType, {
          replyToId: replyingTo?.messageId,
          attachments,
        });
        onCancelReply?.();
        showSuccess(MESSENGER_COPY.messageInput.actionSuccess.sendSuccess);
      }

      setText("");
      setSelectedFiles([]);
      setShowEmojiPicker(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error: unknown) {
      logger.error("[MessageInput] Failed to send message", error instanceof Error ? error.message : String(error));
      showError(getUserFacingErrorMessage(error, MESSENGER_COPY.messageInput.actionSuccess.sendFailure));
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }, [
    activeConversationId,
    clearTypingState,
    editMessage,
    editingMessage,
    onCancelEdit,
    onCancelReply,
    replyingTo?.messageId,
    selectedFiles,
    sendMessage,
    text,
    buildValidFiles,
    uploadMessageFiles,
    showSuccess,
    showWarning,
  ]);

  const handleCreatePoll = useCallback(async (data: CreatePollRequest) => {
    try {
      await createPoll(data);
      showSuccess(MESSENGER_COPY.messageInput.actionSuccess.copyPollCreated);
    } catch (error: unknown) {
      logger.error("[MessageInput] Failed to create poll", error instanceof Error ? error.message : String(error));
      showError(getUserFacingErrorMessage(error, MESSENGER_COPY.messageInput.actionSuccess.copyPollCreateError));
    }
  }, [showSuccess]);

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const { validFiles, invalidMessages } = buildValidFiles(files);

    invalidMessages.forEach((message) => {
      showWarning(message);
    });

    if (validFiles.length === 0) {
      event.target.value = "";
      return;
    }

    setSelectedFiles((current) => {
      const remainingSlots = MAX_FILES_PER_MESSAGE - current.length;
      if (remainingSlots <= 0) {
        showWarning(MESSENGER_COPY.messageInput.actionSuccess.maxFilesPerMessage);
        return current.slice(0, MAX_FILES_PER_MESSAGE);
      }

      const accepted = validFiles.slice(0, remainingSlots);
      if (accepted.length < validFiles.length) {
        showWarning(MESSENGER_COPY.messageInput.actionSuccess.fileExtraAllowed(remainingSlots));
      }

      return [...current, ...accepted];
    });

    event.target.value = "";
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (mentionQuery !== null) {
      if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) {
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setText((current) => current + emojiData.emoji);
  };

  const handleUnblock = async () => {
    const conv = conversationsFromStore.find((conversation) => conversation.conversationId === activeConversationId);
    if (!conv?.otherParticipant?.userId || !user?.userId || isUnblocking) return;
    setIsUnblocking(true);
    try {
      await unblockFriend(conv.otherParticipant.userId);
      const status = await friendApi.checkBlockStatus(conv.otherParticipant.userId);
      setBlockStatus(status);
      void fetchBlockedUsers();
      notifySuccess(localizeText('Đã bỏ chặn người dùng.'));
    } catch (error: unknown) {
      logger.error('[MessageInput] Failed to unblock user', error instanceof Error ? error.message : String(error));
      notifyError(getUserFacingErrorMessage(error, localizeText('Không thể bỏ chặn người dùng.')));
    } finally {
      setIsUnblocking(false);
    }
  };

  if (blockStatusLoading) {
    return <div className="flex items-center justify-center rounded-[2rem] border border-border/50 bg-card/75 p-4 text-sm text-muted-foreground" role="status">{localizeText('Đang kiểm tra trạng thái chặn...')}</div>;
  }

  if (blockStatusError) {
    return <div className="flex items-center justify-between gap-3 rounded-[2rem] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert"><span>{localizeText('Không thể kiểm tra trạng thái chặn.')}</span><Button type="button" variant="outline" size="sm" onClick={() => setBlockStatusRetry((value) => value + 1)}>{localizeText('Thử lại')}</Button></div>;
  }

  if (blockStatus?.hasBlocked || blockStatus?.isBlockedBy) {
    return (
      <MessageInputBlockedState
        hasBlocked={blockStatus?.hasBlocked}
        isBlockedBy={blockStatus?.isBlockedBy}
        onUnblock={handleUnblock}
        isLoading={isUnblocking}
      />
    );
  }

  return (
    <div className="relative">
      {showEmojiPicker && (
        <motion.div
          className="absolute bottom-full mb-4 left-0 z-50"
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.slideInFromBottom}
        >
          <div className="neo-shadow rounded-2xl overflow-hidden glass border-2 border-border/50">
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              theme={Theme.AUTO}
              width={320}
              height={400}
              lazyLoadEmojis
              searchPlaceHolder={MESSENGER_COPY.messageInput.toolbar.searchEmoji}
            />
          </div>
          <div className="fixed inset-0 z-[-1]" onClick={() => setShowEmojiPicker(false)} />
        </motion.div>
      )}

      {activeConversationId && (
        <MentionMenu conversationId={activeConversationId} query={mentionQuery} onSelect={handleMentionSelect} onClose={handleMentionClose} />
      )}

      {activeConversationId && (
        <CreatePollModal
          conversationId={activeConversationId}
          isOpen={showPollModal}
          onClose={() => setShowPollModal(false)}
          onSubmit={handleCreatePoll}
        />
      )}

      <div className="glass p-2 rounded-[2rem] neo-shadow flex flex-col gap-2 transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-300 focus-within:ring-2 ring-primary/20">
        <MessageInputDraftPanel
          replyingTo={replyingTo}
          editingMessage={editingMessage}
          selectedFiles={selectedFiles}
          onCancelReply={onCancelReply}
          onCancelEdit={onCancelEdit}
          onRemoveFile={removeSelectedFile}
        />

        <div className="flex items-end gap-2 px-2">
          <MessageInputToolbar
            onAttachFile={() => fileInputRef.current?.click()}
            onAttachMedia={() => mediaInputRef.current?.click()}
            onOpenPoll={() => setShowPollModal(true)}
            onToggleEmoji={() => setShowEmojiPicker((isOpen) => !isOpen)}
            showEmojiPicker={showEmojiPicker}
            onShowVoice={() => onStartCall("VOICE")}
            canShowVoice={canStartCall}
            onSend={() => void handleSend()}
            canSend={Boolean(text.trim() || selectedFiles.length > 0) && !isSending}
          />

          <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFilesSelected} />
          <input
            ref={mediaInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,audio/*"
            multiple
            onChange={handleFilesSelected}
          />

          <div className="flex-1 px-2 py-1">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={MESSENGER_COPY.messageInput.placeholder}
              rows={1}
              className="border-0 bg-transparent p-0 py-3 text-sm font-medium placeholder:text-muted-foreground/40 outline-none custom-scrollbar max-h-32"
              style={{ height: "auto" }}
              onInput={(event) => {
                const target = event.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;


