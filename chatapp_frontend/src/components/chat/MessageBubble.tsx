// src/components/chat/MessageBubble.tsx
// Refactored: extracted MessageContextMenu and usePopupPosition

import React, { useState } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import type { MessageResponseDto } from '@/types/message';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { MessageContextMenu } from './MessageContextMenu';
import { MessageFileAttachment } from './MessageFileAttachment';
import { ReactionPicker } from './ReactionPicker';
import { usePopupPosition } from '@/hooks/common/usePopupPosition';
import { cn } from '@/lib/utils';

const MENU_DIMENSIONS = { width: 180, height: 150 };

interface MessageBubbleProps {
  message: MessageResponseDto;
  isOwn: boolean;
  showAvatar?: boolean;
  showName?: boolean;
  onReply?: (message: MessageResponseDto) => void;
  onReact?: (emoji: string) => void;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showAvatar = true,
  showName = true,
  onReply,
  onReact,
  onEdit,
  onDelete,
}) => {
  const [isTimestampToggled, setIsTimestampToggled] = useState(false);
  const contextMenu = usePopupPosition();

  const timeDisplay = new Date(message.createdAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    contextMenu.open(e.clientX, e.clientY, MENU_DIMENSIONS);
  };

  return (
    <>
      <div className={cn('group flex mb-2', isOwn ? 'justify-end' : 'justify-start')}>
        <div className={cn('flex gap-2 max-w-[75%]', isOwn ? 'flex-row-reverse items-end' : 'flex-row items-end')}>
          {/* Avatar (other user only) */}
          {!isOwn && (
            <div className="flex-shrink-0 w-8">
              {showAvatar && (
                <Avatar className="h-8 w-8 ring-2 ring-gray-50 dark:ring-gray-900">
                  <AvatarImage src={message.sender.avatarUrl} alt={message.sender.displayName} />
                  <AvatarFallback className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
                    {(message.sender.displayName || message.sender.userName)[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          )}

          <div className={cn('relative flex flex-col min-w-0', isOwn ? 'items-end' : 'items-start')}>
            {/* Sender name */}
            {!isOwn && showName && (
              <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-0.5 px-2">
                {message.sender.displayName}
              </div>
            )}

            <div className="relative flex flex-col">
              {/* Reply preview */}
              {message.replyTo && (
                <div
                  className={cn(
                    'mb-0.5 p-2 rounded-lg bg-muted border-l-2 border-primary text-xs',
                    isOwn ? 'text-right' : 'text-left'
                  )}
                >
                  <div className="text-primary font-medium">{message.replyTo.sender.displayName}</div>
                  <div className="text-muted-foreground truncate">{message.replyTo.content}</div>
                </div>
              )}

              {/* Message content */}
              <div
                onClick={() => setIsTimestampToggled(!isTimestampToggled)}
                onContextMenu={handleContextMenu}
                className={cn(
                  'relative px-3 py-2 rounded-2xl break-words shadow-sm max-w-full cursor-pointer transition-colors',
                  isOwn
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground border border-border rounded-bl-sm'
                )}
              >
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap m-0">{message.content}</p>
              </div>

              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <MessageFileAttachment
                  attachments={message.attachments.map(a => ({
                    url: a.url,
                    fileName: a.fileName,
                    contentType: a.mimeType,
                    fileSize: a.fileSize,
                    resourceType: a.attachmentType.toLowerCase(),
                  }))}
                />
              )}

              {/* Images */}
              {message.images && message.images.length > 0 && (
                <MessageFileAttachment
                  attachments={message.images.map(img => ({
                    url: img.url,
                    fileName: img.fileName,
                    contentType: 'image/jpeg',
                    fileSize: img.fileSize,
                    resourceType: 'image',
                  }))}
                />
              )}
            </div>

            {/* Reaction picker (hover trigger) */}
            <ReactionPicker
              conversationId={message.conversationId}
              messageId={message.messageId}
            />

            {/* Reactions */}
            {message.reactions && message.reactions.length > 0 && (
              <div className={cn('flex flex-wrap gap-1 mt-1', isOwn ? 'justify-end mr-1' : 'justify-start ml-1')}>
                {message.reactions.map((reaction) => (
                  <button
                    key={reaction.emoji}
                    onClick={() => onReact?.(reaction.emoji)}
                    className={cn(
                      'flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs transition-colors border',
                      reaction.reactedByCurrentUser
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'bg-background border-border hover:bg-muted'
                    )}
                  >
                    <span>{reaction.emoji}</span>
                    <span className={reaction.reactedByCurrentUser ? 'text-primary-foreground' : 'text-muted-foreground'}>
                      {reaction.count}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Timestamp (toggled on click) */}
            <div
              className={cn(
                'text-[11px] text-muted-foreground px-1 transition-all duration-200',
                isOwn ? 'text-right' : 'text-left',
                isTimestampToggled ? 'opacity-100 h-auto mt-1' : 'opacity-0 h-0'
              )}
            >
              {timeDisplay}
              {message.status === 'sending' && <span className="text-primary"> • Sending...</span>}
              {message.status === 'sent' && <Check className="inline w-3 h-3 text-muted-foreground ml-1" />}
              {message.status === 'delivered' && <CheckCheck className="inline w-3 h-3 text-muted-foreground ml-1" />}
              {message.status === 'received' && <CheckCheck className="inline w-3 h-3 text-blue-500 ml-1" />}
              {message.status === 'failed' && <span className="text-destructive"> • Failed</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Context menu (portal-like fixed positioning) */}
      {contextMenu.isOpen && contextMenu.position && (
        <MessageContextMenu
          position={contextMenu.position}
          menuRef={contextMenu.ref}
          isOwn={isOwn}
          onReact={(emoji) => { onReact?.(emoji); contextMenu.close(); }}
          onReply={onReply ? () => onReply(message) : undefined}
          onEdit={onEdit ? () => onEdit(message.messageId) : undefined}
          onDelete={onDelete ? () => onDelete(message.messageId) : undefined}
          onClose={contextMenu.close}
        />
      )}
    </>
  );
};
