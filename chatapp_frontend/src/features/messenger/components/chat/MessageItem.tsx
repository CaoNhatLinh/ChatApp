import React from 'react';
import type { Message } from '../../types/messenger.types';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { format } from 'date-fns';
import { cn } from '@/shared/lib/cn';
import { MoreHorizontal, Reply, Copy, Trash2, RefreshCw, Pencil, Pin, Flag } from 'lucide-react';
import { ReactionPicker } from '@/features/messenger/components/chat/ui/ReactionPicker';
import { ReactionDisplay as ReactionBadgeList } from '@/features/messenger/components/chat/ui/ReactionDisplay';
import { MentionText } from './MentionText';
import { PollCard } from '../Poll/PollCard';
import { usePresence } from '@/features/presence/model/presence.store';
import { StatusDot } from '@/features/presence/ui/StatusSelector';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/ui/Avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import { localizeText } from '@/shared/i18n';

interface MessageItemProps {
    message: Message;
    showAvatar: boolean;
    isBlocked?: boolean;
    isHighlighted?: boolean;
    roomBubbleStyle?: string;
    dataMessageId?: string;
    onAction?: (action: string, message: Message) => void;
    onUserClick?: (userId: string) => void;
    onRetry?: (messageId: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
    message,
    showAvatar,
    isBlocked,
    isHighlighted,
    roomBubbleStyle,
    dataMessageId,
    onAction,
    onUserClick,
    onRetry
}) => {
    const attachments = message.attachments;
    const { user } = useAuthStore();
    const [isRevealed, setIsRevealed] = React.useState(false);
    const isOwn = message.sender.userId === user?.userId;
    const isPoll = message.type === 'POLL' && message.poll;
    const { presence } = usePresence(message.sender.userId);
    const isOnline = presence?.isOnline ?? false;
    const status = presence?.status ?? 'OFFLINE';
    const isFailed = message.status === 'failed';
    const latestSeenAt = React.useMemo(() => {
        if (!isOwn || !message.readReceipts || message.readReceipts.length === 0) {
            return null;
        }
        return [...message.readReceipts]
            .sort((left, right) => new Date(right.readAt).getTime() - new Date(left.readAt).getTime())[0]?.readAt ?? null;
    }, [isOwn, message.readReceipts]);

    const handleAction = (action: string) => {
        if (onAction) {
            onAction(action, message);
        }
    };

    const createdAt = React.useMemo(() => {
        return new Date(message.createdAt);
    }, [message.createdAt]);

    return (
        <motion.div
            data-message-id={dataMessageId}
            className={cn(
                "flex w-full gap-3",
                isPoll ? "justify-center" : (isOwn ? "flex-row-reverse" : "flex-row"),
                isHighlighted ? "ring-2 ring-primary ring-offset-2 rounded-2xl" : undefined
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
                                <AvatarFallback className="bg-primary/10 text-primary font-black uppercase text-xs">
                                    {message.sender.displayName?.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                            <StatusDot
                                status={status}
                                isOnline={isOnline}
                                size="sm"
                                className="absolute bottom-[-1px] right-[-1px] border-2 border-background"
                            />
                        </>
                    )}
                </div>
            )}

            {/* Message Content Area */}
            <div className={cn(
                "flex flex-col",
                isPoll ? "max-w-[85%]" : "max-w-[70%]",
                isOwn ? "items-end" : "items-start"
            )}>
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
                            "px-4 py-3 rounded-3xl relative transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-300",
                            roomBubbleStyle,
                            isOwn
                                ? "bg-primary text-primary-foreground rounded-tr-none neo-shadow hover:translate-x-[-2px] hover:translate-y-[-2px]"
                                : "glass rounded-tl-none hover:bg-background/40"
                        )}>
                            {message.replyTo && !message.isDeleted && (
                                <button
                                    type="button"
                                    onClick={() => handleAction('jump-reply')}
                                    className={cn(
                                        'mb-2 w-full rounded-2xl px-3 py-2 text-left text-xs border',
                                        isOwn ? 'bg-primary-foreground/10 border-primary-foreground/10 text-primary-foreground/80' : 'bg-primary/5 border-primary/10 text-foreground/70'
                                    )}
                                >
                                    <span className="block font-black uppercase tracking-widest text-[9px] opacity-70">{message.replyTo.senderName}</span>
                                    <span className="block truncate">{message.replyTo.content}</span>
                                </button>
                            )}
                            {isBlocked && !isRevealed ? (
                                <div className="flex items-center gap-2 group/blocked cursor-pointer" onClick={() => setIsRevealed(true)}>
                                    <span className="italic opacity-70 text-sm">{MESSENGER_COPY.message.hidden}</span>
                                    <span className="text-[10px] font-bold text-primary opacity-0 group-hover/blocked:opacity-100 transition-opacity uppercase">{MESSENGER_COPY.message.revealAction}</span>
                                </div>
                            ) : (
                                <MentionText
                                    content={message.content}
                                    isOwnMessage={isOwn}
                                    className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words"
                                />
                            )}

                            {attachments && attachments.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {attachments.map((attachment, index) => {
                                        const contentType = attachment.contentType ?? attachment.mimeType ?? '';
                                        const isImage = contentType.startsWith('image/');
                                        const isVideo = contentType.startsWith('video/');

                                        if (isImage) {
                                            return (
                                                <a key={`${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-border/30">
                                                    <img src={attachment.mediumUrl ?? attachment.url} alt={attachment.fileName} className="max-h-64 w-full object-cover" />
                                                </a>
                                            );
                                        }

                                        if (isVideo) {
                                            return (
                                                <video key={`${attachment.url}-${index}`} controls className="max-h-72 w-full rounded-2xl border border-border/30 bg-black/30">
                                                    <source src={attachment.url} type={contentType || undefined} />
                                                </video>
                                            );
                                        }

                                        return (
                                            <a key={`${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-border/30 bg-background/30 px-3 py-2 text-xs font-semibold">
                                                <span className="truncate pr-3">{attachment.fileName}</span>
                                                <span className="text-primary">Mở</span>
                                            </a>
                                        );
                                    })}
                                </div>
                            )}

                            <div className={cn(
                                "absolute -bottom-5 flex items-center gap-1 transition-opacity whitespace-nowrap",
                                isFailed ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                                isOwn ? "right-2" : "left-2"
                            )}>
                                <span className="text-[9px] font-bold uppercase tracking-tighter">
                                    {format(createdAt, 'HH:mm')}
                                </span>
                                {!message.isDeleted && message.updatedAt && message.updatedAt !== message.createdAt && (
                                    <button type="button" onClick={() => handleAction('view-history')} className="text-[9px] font-black uppercase text-amber-600 hover:text-amber-500">
                                        {MESSENGER_COPY.message.historyLabel}
                                    </button>
                                )}
                                {isOwn && (
                                    latestSeenAt ? (
                                        <button type="button" onClick={() => handleAction('view-seen')} className="text-[9px] font-black uppercase text-primary">
                                            {MESSENGER_COPY.message.seenLabel}
                                        </button>
                                    ) : (
                                        <span className={cn(
                                            "text-[9px] font-black uppercase",
                                            message.status === 'failed' ? "text-destructive" : "text-primary"
                                        )}>
                                            {message.status === 'sending' ? MESSENGER_COPY.message.sending : message.status === 'failed' ? MESSENGER_COPY.message.failed : MESSENGER_COPY.message.sent}
                                        </span>
                                    )
                                )}
                            </div>
                        </div>
                    )}

                    {isFailed && isOwn && (
                        <button
                            onClick={() => onRetry?.(message.messageId)}
                            className="ml-1 p-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-full transition-colors flex z-10 items-center justify-center cursor-pointer"
                            title={MESSENGER_COPY.message.retryTitle}
                        >
                            <RefreshCw size={14} className="stroke-[2.5px]" />
                        </button>
                    )}

                    {!isPoll && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200">
                            <ReactionPicker
                                conversationId={message.conversationId}
                                messageBucket={message.messageBucket}
                                messageId={message.messageId}
                            />

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="p-1 hover:bg-primary/10 rounded-full text-muted-foreground hover:text-primary transition-colors outline-none">
                                        <MoreHorizontal size={16} />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={isOwn ? "end" : "start"} className="rounded-2xl glass neo-shadow border-border/50 p-1.5 min-w-[150px]">
                                    <DropdownMenuItem
                                        onClick={() => handleAction('reply')}
                                        className="gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/10 transition-colors text-xs font-bold cursor-pointer"
                                    >
                                        <Reply size={14} className="text-primary" />
                                        <span>{MESSENGER_COPY.message.replyLabel}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => handleAction('copy')}
                                        className="gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/10 transition-colors text-xs font-bold cursor-pointer"
                                    >
                                        <Copy size={14} className="text-primary" />
                                        <span>{MESSENGER_COPY.message.copyLabel}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => handleAction('pin')}
                                        className="gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/10 transition-colors text-xs font-bold cursor-pointer"
                                    >
                                        <Pin size={14} className="text-primary" />
                                        <span>{MESSENGER_COPY.message.pinLabel}</span>
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
                                            {!message.isDeleted && (
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

                {message.messageBucket && message.reactions && message.reactions.length > 0 && (
                    <div className={cn("px-2", isOwn ? "flex justify-end" : "") }>
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

