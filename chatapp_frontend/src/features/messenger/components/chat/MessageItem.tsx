import React from 'react';
import type { Message } from '../../types/messenger.types';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { format } from 'date-fns';
import { cn } from '@/shared/lib/cn';
import { MoreHorizontal, Reply, Copy, Trash2, RefreshCw, Pencil, Pin, PinOff, Flag, MessageSquare, Forward } from 'lucide-react';
import { ReactionPicker } from '@/features/messenger/components/chat/ui/ReactionPicker';
import { ReactionDisplay as ReactionBadgeList } from '@/features/messenger/components/chat/ui/ReactionDisplay';
import { MentionText } from './MentionText';
import { PollCard } from '../Poll/PollCard';
import { usePresence } from '@/features/presence/model/presence.store';
import { StatusDot } from '@/features/presence/ui/StatusSelector';
import { Avatar, AvatarImage, AvatarFallback, DefaultUserAvatar } from '@/shared/ui/Avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { useTrackPresenceInViewport } from '@/features/presence/hooks/useTrackPresence';
import type { ChatBubbleStylePreset } from '@/features/settings/constants/chat-theme.constants';
import { MessageSticker } from '@/features/stickers/components/MessageSticker';
import { MessageGif } from '@/features/gifs/components/MessageGif';
import { MessageAttachments } from './MessageAttachments';

interface MessageItemProps {
    readOnly?: boolean;
    message: Message;
    showAvatar: boolean;
    isBlocked?: boolean;
    isHighlighted?: boolean;
    roomBubbleStyle?: ChatBubbleStylePreset;
    dataMessageId?: string;
    onAction?: (action: string, message: Message) => void;
    onUserClick?: (userId: string) => void;
    onRetry?: (messageId: string) => Promise<'unconfirmed' | void>;
    presenceConversationId?: string | null;
}

export const MessageItem: React.FC<MessageItemProps> = ({
    readOnly = false,
    message,
    showAvatar,
    isBlocked,
    isHighlighted,
    roomBubbleStyle,
    dataMessageId,
    onAction,
    onUserClick,
    onRetry,
    presenceConversationId,
}) => {
    const pendingDialogAction = React.useRef<'thread' | 'forward' | null>(null);
    const { locale } = useAppLocale();
    const { user } = useAuthStore();
    const [isRevealed, setIsRevealed] = React.useState(false);
    const [isRetrying, setIsRetrying] = React.useState(false);
    const [retryUnconfirmed, setRetryUnconfirmed] = React.useState(false);
    const isOwn = message.sender.userId === user?.userId;
    const presenceRef = useTrackPresenceInViewport<HTMLDivElement>(
        isOwn ? [] : [message.sender.userId],
        presenceConversationId ?? null,
    );
    const isPoll = !message.isDeleted && message.type === 'POLL' && message.poll;
    const { presence } = usePresence(message.sender.userId);
    const isFailed = message.status === 'failed';
    const latestSeenAt = React.useMemo(() => {
        if (!isOwn) {
            return null;
        }
        if (message.latestReadAt) {
            return message.latestReadAt;
        }
        if (!message.readReceipts || message.readReceipts.length === 0) return null;
        return [...message.readReceipts]
            .sort((left, right) => new Date(right.readAt).getTime() - new Date(left.readAt).getTime())[0]?.readAt ?? null;
    }, [isOwn, message.latestReadAt, message.readReceipts]);

    const handleAction = (action: string) => {
        if (onAction) {
            onAction(action, message);
        }
    };

    const handleRetry = async () => {
        if (!onRetry || isRetrying) return;
        setIsRetrying(true);
        setRetryUnconfirmed(false);
        try {
            setRetryUnconfirmed(await onRetry(message.messageId) === 'unconfirmed');
        } finally {
            setIsRetrying(false);
        }
    };

    const createdAt = React.useMemo(() => {
        return new Date(message.createdAt);
    }, [message.createdAt]);

    return (
        <motion.div
            ref={presenceRef}
            lang={locale}
            data-message-id={dataMessageId}
            className={cn(
                "flex w-full gap-2.5 sm:gap-3",
                isPoll ? "justify-center" : (isOwn ? "flex-row-reverse" : "flex-row"),
                isHighlighted ? "rounded-[var(--radius-md)] ring-2 ring-primary ring-offset-2" : undefined
            )}
            initial={UI_MOTION_CONFIG.initialState}
            animate={UI_MOTION_CONFIG.animateState}
            variants={UI_MOTION_VARIANTS.fadeIn}
        >
            {/* Avatar Container */}
            {!isPoll && (
                <div className="w-10 h-10 flex-shrink-0 mt-auto relative">
                    {showAvatar && !isOwn && (
                        <>
                            <Avatar
                                className="w-10 h-10 rounded-xl border-2 border-primary/20 neo-shadow cursor-pointer hover:border-primary transition-[color,background-color,border-color,box-shadow,transform,opacity]"
                                onClick={() => onUserClick?.(message.sender.userId)}
                            >
                                <AvatarImage src={message.sender.avatarUrl} />
                                <AvatarFallback className="bg-primary/10">
                                    <DefaultUserAvatar alt={localizeText('Ảnh đại diện mặc định')} />
                                </AvatarFallback>
                            </Avatar>
                            {presence ? (
                                <StatusDot
                                    status={presence.status}
                                    isOnline={presence.isOnline}
                                    size="sm"
                                    className="absolute bottom-[-1px] right-[-1px] border-2 border-background"
                                />
                            ) : null}
                        </>
                    )}
                </div>
            )}

            {/* Message Content Area */}
            <div className={cn(
                "flex flex-col",
                isPoll ? "max-w-[94%] sm:max-w-[85%]" : "max-w-[82%] sm:max-w-[72%] lg:max-w-[68%]",
                isOwn ? "items-end" : "items-start"
            )}>
                {!message.isDeleted && message.isForwarded ? readOnly ? <span className="mb-1 text-xs text-muted-foreground">{localizeText('Đã chuyển tiếp')}</span> :
                    <button type="button" className="focus-ring mb-1 inline-flex min-h-8 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => handleAction('forward-source')}><Forward size={13} />{localizeText('Xem nguồn chuyển tiếp')}</button> : null}
                {showAvatar && !isOwn && !isPoll && message.sender.displayName && (
                    <span
                        className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 ml-1 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => onUserClick?.(message.sender.userId)}
                    >
                        {message.sender.displayName}
                    </span>
                )}

                <div className={cn(
                    "relative group flex items-center gap-2",
                    isOwn ? "flex-row-reverse" : "flex-row"
                )}>
                    {isPoll ? (
                        message.poll && <PollCard poll={message.poll} />
                    ) : (
                        <div className={cn(
                            "relative px-4 py-3 transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200",
                            isOwn
                                ? roomBubbleStyle?.ownClass ?? "chat-bubble-own bg-primary text-primary-foreground rounded-[var(--radius-md)] rounded-tr-sm shadow-[0_6px_14px_-12px_var(--signal-glow)] hover:translate-x-[-1px] hover:translate-y-[-1px]"
                                : roomBubbleStyle?.peerClass ?? "chat-bubble-peer glass rounded-[var(--radius-md)] rounded-tl-sm hover:bg-background/40"
                        )}>
                            {!readOnly && message.replyTo && !message.isDeleted && (
                                <button
                                    type="button"
                                    onClick={() => handleAction('jump-reply')}
                                    className={cn(
                                        'mb-2 w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-xs border',
                                        isOwn ? 'bg-primary-foreground/10 border-primary-foreground/10 text-primary-foreground/80' : 'bg-primary/5 border-primary/10 text-foreground/70'
                                    )}
                                >
                                    {message.replyTo.senderName && <span className="block font-medium opacity-70">{message.replyTo.senderName}</span>}
                                    <span className="block truncate">{message.replyTo.content ?? localizeText('Xem tin nhắn gốc')}</span>
                                </button>
                            )}
                            {message.isDeleted ? (
                                <span className="text-sm italic opacity-70">{MESSENGER_COPY.messageStatus.deleted}</span>
                            ) : isBlocked && !isRevealed ? (
                                <div className="flex items-center gap-2 group/blocked cursor-pointer" onClick={() => setIsRevealed(true)}>
                                    <span className="italic opacity-70 text-sm">{MESSENGER_COPY.message.hidden}</span>
                                    <span className="text-[10px] font-bold text-primary opacity-0 group-hover/blocked:opacity-100 transition-opacity uppercase">{MESSENGER_COPY.message.revealAction}</span>
                                </div>
                            ) : message.type === 'STICKER' ? (
                                <MessageSticker message={message} />
                            ) : message.type === 'GIF' ? (
                                <MessageGif key={`${message.messageId}:${message.gif?.providerGifId}`} message={message} />
                            ) : (
                                <MentionText
                                    content={message.content}
                                    isOwnMessage={isOwn}
                                    className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words"
                                />
                            )}

                            <MessageAttachments message={message} />

                            <div className={cn(
                                "chat-bubble-meta mt-2 flex items-center gap-2 whitespace-nowrap text-xs",
                                isFailed && "opacity-100",
                                isOwn ? "justify-end" : "justify-start"
                            )}>
                                <span className="font-semibold tracking-[0.04em]">
                                    {format(createdAt, 'HH:mm')}
                                </span>
                                {!readOnly && !message.isDeleted && message.updatedAt && message.updatedAt !== message.createdAt && (
                                    <button type="button" onClick={() => handleAction('view-history')} className="text-xs font-medium underline-offset-4 hover:underline">
                                        {MESSENGER_COPY.message.historyLabel}
                                    </button>
                                )}
                                {isOwn && (
                                    latestSeenAt && !readOnly ? (
                                        <button type="button" onClick={() => handleAction('view-seen')} className="text-xs font-medium underline-offset-4 hover:underline">
                                            {MESSENGER_COPY.message.seenLabel}
                                        </button>
                                    ) : (
                                        <span className={cn(
                                            "text-xs font-medium",
                                            message.status === 'failed' && "text-destructive"
                                        )}>
                                            {message.status === 'sending' ? MESSENGER_COPY.message.sending : message.status === 'failed' ? MESSENGER_COPY.message.failed : MESSENGER_COPY.message.sent}
                                        </span>
                                    )
                                )}
                            </div>
                        </div>
                    )}

                    {!readOnly && isFailed && isOwn && message.pendingSend && !message.retryAttachmentUnavailable && onRetry && (
                        <button
                            type="button"
                            onClick={() => void handleRetry()}
                            disabled={isRetrying}
                            aria-busy={isRetrying}
                            aria-label={MESSENGER_COPY.message.retryTitle}
                            className="focus-ring ml-1 min-h-11 min-w-11 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-full transition-colors flex z-10 items-center justify-center cursor-pointer disabled:cursor-wait"
                            title={MESSENGER_COPY.message.retryTitle}
                        >
                            <RefreshCw size={14} className={cn("stroke-[2.5px]", isRetrying && "motion-safe:animate-spin")} />
                        </button>
                    )}

                    {!readOnly && !isPoll && !message.isDeleted && (
                        <div className="flex items-center gap-1 opacity-100 transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                            <ReactionPicker
                                conversationId={message.conversationId}
                                messageBucket={message.messageBucket}
                                messageId={message.messageId}
                            />

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button type="button" aria-label={localizeText('Tùy chọn khác')} className="p-1 hover:bg-primary/10 rounded-full text-muted-foreground hover:text-primary transition-colors outline-none">
                                        <MoreHorizontal size={16} />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={isOwn ? "end" : "start"} className="rounded-2xl glass neo-shadow border-border/50 p-1.5 min-w-[150px]"
                                    onCloseAutoFocus={event => {
                                        const action = pendingDialogAction.current;
                                        if (action) { event.preventDefault(); pendingDialogAction.current = null; handleAction(action); }
                                    }}>
                                    <DropdownMenuItem disabled={!message.messageBucket || message.status === 'failed' || message.status === 'sending'}
                                        onSelect={() => { pendingDialogAction.current = 'thread'; }} className="gap-3 px-3 py-2.5 text-xs font-medium">
                                        <MessageSquare size={14} />{localizeText('Xem các trả lời')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem disabled={!message.messageBucket || message.status === 'failed' || message.status === 'sending' || message.type === 'SYSTEM'}
                                        onSelect={() => { pendingDialogAction.current = 'forward'; }} className="gap-3 px-3 py-2.5 text-xs font-medium">
                                        <Forward size={14} />{localizeText('Chuyển tiếp')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        disabled={!message.messageBucket || message.status === 'failed' || message.status === 'sending'}
                                        onClick={() => handleAction('reply')}
                                        className="gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/10 transition-colors text-xs font-bold cursor-pointer"
                                    >
                                        <Reply size={14} className="text-primary" />
                                        <span>{MESSENGER_COPY.message.replyLabel}</span>
                                    </DropdownMenuItem>
                                    {message.type !== 'STICKER' && message.type !== 'GIF' ? <DropdownMenuItem
                                        onClick={() => handleAction('copy')}
                                        className="gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/10 transition-colors text-xs font-bold cursor-pointer"
                                    >
                                        <Copy size={14} className="text-primary" />
                                        <span>{MESSENGER_COPY.message.copyLabel}</span>
                                    </DropdownMenuItem> : null}
                                    <DropdownMenuItem
                                        onClick={() => handleAction('pin')}
                                        className="gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/10 transition-colors text-xs font-bold cursor-pointer"
                                    >
                                        {message.isPinned ? <PinOff size={14} className="text-primary" /> : <Pin size={14} className="text-primary" />}
                                        <span>{message.isPinned ? MESSENGER_COPY.message.unpinLabel : MESSENGER_COPY.message.pinLabel}</span>
                                    </DropdownMenuItem>
                                    {!isOwn && !message.isDeleted && (
                                        <DropdownMenuItem
                                            onClick={() => handleAction('report')}
                                            className="gap-3 px-3 py-2.5 rounded-xl hover:bg-amber-500/10 text-amber-700 transition-colors text-xs font-bold cursor-pointer"
                                        >
                                            <Flag size={14} />
                                            <span>{localizeText('Báo cáo')}</span>
                                        </DropdownMenuItem>
                                    )}
                                    {isOwn && (
                                        <>
                                            <DropdownMenuSeparator className="bg-border/50 my-1 mx-2" />
                                            {!message.isDeleted && !message.isForwarded && message.type !== 'STICKER' && message.type !== 'GIF' && (
                                                <DropdownMenuItem
                                                    onClick={() => handleAction('edit')}
                                                    className="gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/10 transition-colors text-xs font-bold cursor-pointer"
                                                >
                                                    <Pencil size={14} className="text-primary" />
                                                    <span>{MESSENGER_COPY.message.editLabel}</span>
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem
                                                onClick={() => handleAction('delete')}
                                                className="gap-3 px-3 py-2.5 rounded-xl hover:bg-destructive/10 text-destructive transition-colors text-xs font-bold cursor-pointer"
                                            >
                                                <Trash2 size={14} />
                                                <span>{MESSENGER_COPY.message.deleteLabel}</span>
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                </div>

                {!readOnly && isFailed && isOwn && (message.retryAttachmentUnavailable || retryUnconfirmed) && (
                    <p role="status" className="mt-1 text-xs text-muted-foreground">
                        {message.retryAttachmentUnavailable
                            ? (locale === 'vi' ? 'Tệp đính kèm không còn dùng được. Hãy chọn lại tệp.' : 'Attachments are no longer available. Select the files again.')
                            : (locale === 'vi' ? 'Chưa kiểm tra được tệp đính kèm. Hãy thử lại.' : 'Could not check the attachments. Try again.')}
                    </p>
                )}

                {!readOnly && !message.isDeleted && message.messageBucket && message.reactions && message.reactions.length > 0 && (
                    <div className={cn("px-2 pt-1.5", isOwn ? "flex justify-end" : "") }>
                        <ReactionBadgeList
                            reactions={message.reactions}
                            messageId={message.messageId}
                            conversationId={message.conversationId}
                            messageBucket={message.messageBucket}
                        />
                    </div>
                )}
            </div>
        </motion.div>
    );
};

