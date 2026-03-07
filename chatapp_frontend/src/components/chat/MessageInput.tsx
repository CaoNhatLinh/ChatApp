import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Smile, X } from 'lucide-react';
import { useChatContext } from '../../context/SimpleChatContext.js';
import { useConversationStore } from '@/store/conversationStore';
import { useAuthStore } from '@/store/authStore';
import EmojiPicker from '@/components/ui/EmojiPicker';
import { FileUpload } from './FileUpload';
import type { UploadedFile as ServiceUploadedFile } from '@/services/fileUploadService';
import type { SendMessageWsPayload, MessageResponseDto } from '@/types/message';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  replyingTo?: MessageResponseDto | null;
  onCancelReply?: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  replyingTo = null,
  onCancelReply
}) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  // Removed isTyping and typingTimeout - backend TTL handles typing expiration
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const { selectedConversation } = useConversationStore();
  const { user } = useAuthStore();
  const { sendMessage: sendWsMessage, sendTyping } = useChatContext();

  // Debounced typing to avoid spamming backend
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sendTypingTrue = useCallback(() => {
    if (typingTimeoutRef.current) {
      return;
    }
    // 🔤 [MessageInput] Sending typing=true (backend TTL will handle expiration)
    sendTyping(true);
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 1000);
  }, [sendTyping]);

  useEffect(() => {
    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingTo]);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  // Handle sending message
  const handleSendMessage = () => {
    if (!message.trim() || !selectedConversation || !user || isSending) return;

    setIsSending(true);

    try {
      const messagePayload: SendMessageWsPayload = {
        type: "NEW_MESSAGE",
        payload: {
          conversationId: selectedConversation.conversationId,
          type: "TEXT",
          content: message.trim(),
          mentions: [],
          replyTo: replyingTo ? replyingTo.messageId : undefined,
          attachments: []
        }
      };

      sendWsMessage(messagePayload);

      setMessage('');

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      textareaRef.current?.focus();

    } catch (error) {
      console.error('Failed to send message:', error instanceof Error ? error.message : error);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = (uploadedFiles: ServiceUploadedFile[]) => {
    if (!selectedConversation || !user || uploadedFiles.length === 0) return;

    setIsSending(true);

    try {
      // Convert uploaded files to attachment URLs (as string array per SendMessageWsPayload)
      const attachments = uploadedFiles.map(file => file.url);

      // Determine message type based on file type
      let messageType: "TEXT" | "IMAGE" | "FILE" = 'FILE';
      if (uploadedFiles.length === 1) {
        const file = uploadedFiles[0];
        if (file.type.startsWith('image/')) messageType = 'IMAGE';
      }

      // Create file message payload
      const fileMessagePayload: SendMessageWsPayload = {
        type: "NEW_MESSAGE",
        payload: {
          conversationId: selectedConversation.conversationId,
          type: messageType,
          content: message.trim() || `Sent ${uploadedFiles.length} file(s)`,
          mentions: [],
          replyTo: replyingTo ? replyingTo.messageId : undefined,
          attachments: attachments
        }
      };

      // Sending file message from MessageInput

      // Send file message via WebSocket
      sendWsMessage(fileMessagePayload);

      // Clear message and close file upload
      setMessage('');
      setShowFileUpload(false);

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      // Focus back to input
      textareaRef.current?.focus();

    } catch (error) {
      console.error('Failed to send file message:', error instanceof Error ? error.message : error);
      // TODO: Show error toast
    } finally {
      setIsSending(false);
    }
  };

  // Handle file selection (before upload)
  const handleFileSelect = (_files: File[]) => {
    // files selected logic
  };



  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle typing indicator - only trigger typing true, let our callback handle the timeout
  const handleTyping = () => {
    if (selectedConversation && user) {
      sendTypingTrue(); // This already handles the timeout internally
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    adjustTextareaHeight();

    // Only send typing=true when user is typing, backend TTL handles expiration
    if (e.target.value.length > 0) {
      // User is typing - send typing indicator
      handleTyping();
    }
    // No need to send typing=false when input is empty - backend TTL handles it
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newValue = message.slice(0, start) + emoji + message.slice(end);
      setMessage(newValue);

      // Set cursor position after emoji
      setTimeout(() => {
        if (textarea) {
          textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
          textarea.focus();
          adjustTextareaHeight();
        }
      }, 0);
    } else {
      setMessage(prev => prev + emoji);
    }

    // Continue typing indicator when adding emoji
    if (selectedConversation) {
      handleTyping();
    }
  };

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, []);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't close if clicking on emoji button or inside emoji picker
      if (
        emojiButtonRef.current?.contains(target) ||
        document.querySelector('.emoji-picker')?.contains(target)
      ) {
        return;
      }

      if (showEmojiPicker) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  if (!selectedConversation) {
    return null;
  }

  return (
    <div className="relative">
      <div className="flex items-end space-x-2">
        {/* Attachment button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowFileUpload(true)}
          title="Attach file"
          className="transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <Paperclip className="w-5 h-5" />
        </Button>

        {/* Message input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="w-full bg-background border border-input rounded-lg px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow duration-200 resize-none overflow-hidden"
            style={{ minHeight: '44px', maxHeight: '120px' }}
            rows={1}
          />

          {/* Emoji button */}
          <div className="relative">
            <button
              ref={emojiButtonRef}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={cn(
                "absolute right-2 bottom-2 p-1.5 rounded transition-all duration-200 hover:scale-110 active:scale-95",
                showEmojiPicker
                  ? 'text-primary bg-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
              title="Add emoji"
            >
              <Smile className="w-4 h-4" />
            </button>

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <EmojiPicker
                isVisible={showEmojiPicker}
                onEmojiSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>
        </div>

        {/* Send button */}
        <Button
          onClick={handleSendMessage}
          disabled={!message.trim() || isSending}
          size="icon"
          className={cn(
            "transition-all duration-200 hover:scale-105 active:scale-95",
            message.trim() && !isSending && "shadow-md hover:shadow-lg"
          )}
          title={isSending ? "Sending..." : "Send message"}
        >
          {isSending ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>

      {/* Replying to indicator */}
      {replyingTo && (
        <div className="mt-2 p-3 bg-muted rounded-lg border-l-4 border-primary">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              Replying to{' '}
              <span className="font-semibold">
                {replyingTo.sender.displayName}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancelReply}
              className="h-6 w-6"
              title="Cancel reply"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {replyingTo.content}
          </div>
        </div>
      )}

      {/* Character counter (optional) */}
      {message.length > 500 && (
        <div className="text-right mt-2">
          <span className={cn(
            "text-xs",
            message.length > 1000 ? 'text-destructive' : 'text-muted-foreground'
          )}>
            {message.length}/1000
          </span>
        </div>
      )}

      {/* File Upload Modal */}
      {showFileUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto border border-border shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Upload Files
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFileUpload(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <FileUpload
              onFileSelect={handleFileSelect}
              onFileUpload={handleFileUpload}
              maxFiles={5}
              maxFileSize={10} // 10MB
              acceptedFileTypes={[
                'image/*',
                'video/*',
                'audio/*',
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain'
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageInput;
