import React from 'react';
import type { Message } from '../../types/messenger.types';
import { useAuthStore } from '@/store/authStore';
import { format } from 'date-fns';
import { cn } from '@/common/lib/utils';
import { MoreHorizontal, Reply, Copy, Trash2, RefreshCw } from 'lucide-react';
import { ReactionPicker, ReactionDisplay } from '@/components/chat/ReactionPicker';
import { MentionText } from './MentionText';
import { PollCard } from '../Poll/PollCard';
import { useIsUserOnline } from '@/store/presenceStore';


interface MessageItemProps {
    message: Message;
    showAvatar: boolean;
    isBlocked?: boolean;
    onAction?: (action: string, messageId: string) => void;
    onUserClick?: (userId: string) => void;
    onRetry?: (messageId: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, showAvatar, isBlocked, onAction, onUserClick, onRetry }) => {
    const { user } = useAuthStore();
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [isRevealed, setIsRevealed] = React.useState(false);
    const isOwn = message.sender.userId === user?.userId;
    const isPoll = message.type === 'POLL' && message.poll;
    const isOnline = useIsUserOnline(message.sender.userId);
    const isFailed = message.status === 'failed';

    const handleAction = (action: string) => {
        setIsMenuOpen(false);
        if (onAction) {
            onAction(action, message.messageId);
        }
    };

    return (
        <div className={cn(
            "flex w-full gap-3 animate-in fade-in duration-300",
            isPoll ? "justify-center" : (isOwn ? "flex-row-reverse" : "flex-row")
        )}>
            {/* Avatar Container */}
            {!isPoll && (
                <div className="w-10 h-10 flex-shrink-0 mt-auto relative">
                    {showAvatar && !isOwn && (
                        <>
                            <div
                                className="w-10 h-10 rounded-xl overflow-hidden border-2 border-primary/20 bg-primary/10 flex items-center justify-center font-black text-primary text-xs uppercase cursor-pointer hover:border-primary transition-all"
                                onClick={() => onUserClick?.(message.sender.userId)}
                            >
                                {message.sender.avatarUrl ? (
                                    <img src={message.sender.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    message.sender.displayName?.charAt(0)
                                )}
                            </div>
                            <div className={cn(
                                "absolute bottom-[-1px] right-[-1px] w-3 h-3 rounded-full border-2 border-background shadow-sm",
                                isOnline ? "bg-green-500" : "bg-muted-foreground"
                            )} />
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
                {/* Sender Name for non-DMs/Group chats if needed */}
                {showAvatar && !isOwn && !isPoll && (
                    <span
                        className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 ml-1 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => onUserClick?.(message.sender.userId)}
                    >
                        {message.sender.displayName}
                    </span>
                )}

                {/* Message Bubble & Actions Wrapper */}
                <div className={cn(
                    "relative group flex items-center gap-2",
                    isOwn ? "flex-row-reverse" : "flex-row"
                )}>
                    {/* Message Bubble */}
                    {isPoll ? (
                        /* Poll message — render PollCard instead of text bubble */
                        message.poll && <PollCard poll={message.poll} />
                    ) : (
                        <div className={cn(
                            "px-4 py-3 rounded-3xl relative transition-all duration-300",
                            isOwn
                                ? "bg-primary text-primary-foreground rounded-tr-none neo-shadow hover:translate-x-[-2px] hover:translate-y-[-2px]"
                                : "glass rounded-tl-none hover:bg-background/40"
                        )}>
                            {isBlocked && !isRevealed ? (
                                <div className="flex items-center gap-2 group/blocked cursor-pointer" onClick={() => setIsRevealed(true)}>
                                    <span className="italic opacity-70 text-sm">Tin nhắn đã bị ẩn</span>
                                    <span className="text-[10px] font-bold text-primary opacity-0 group-hover/blocked:opacity-100 transition-opacity uppercase">Xem</span>
                                </div>
                            ) : (
                                <MentionText
                                    content={message.content}
                                    isOwnMessage={isOwn}
                                    className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words"
                                />
                            )}

                            {/* Status / Time Overlay (Shown on hover, or permanently if failed) */}
                            <div className={cn(
                                "absolute -bottom-5 flex items-center gap-1 transition-opacity whitespace-nowrap",
                                isFailed ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                                isOwn ? "right-2" : "left-2"
                            )}>
                                <span className="text-[9px] font-bold uppercase tracking-tighter opacity-70">
                                    {format(new Date(message.createdAt as unknown as string | number | Date), 'HH:mm')}
                                </span>
                                {isOwn && (
                                    <span className={cn(
                                        "text-[9px] font-black uppercase",
                                        isFailed ? "text-destructive" : "text-primary"
                                    )}>
                                        {message.status === 'sending' ? 'Đang gửi...' : isFailed ? 'Không gửi được' : 'Đã gửi'}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Retry Button for Failed Messages */}
                    {isFailed && isOwn && (
                        <button
                            onClick={() => onRetry?.(message.messageId)}
                            className="ml-1 p-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-full transition-colors flex z-10 items-center justify-center cursor-pointer"
                            title="Thử gửi lại"
                        >
                            <RefreshCw size={14} className="stroke-[2.5px]" />
                        </button>
                    )}

                    {/* Actions Menu */}
                    <div className={cn(
                        "relative opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-0.5",
                        isMenuOpen ? "opacity-100 z-10" : ""
                    )}>
                        {/* Reaction Picker */}
                        <ReactionPicker
                            conversationId={message.conversationId}
                            messageId={message.messageId}
                        />

                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-1 hover:bg-primary/10 rounded-full text-muted-foreground hover:text-primary transition-colors"
                        >
                            <MoreHorizontal size={16} />
                        </button>

                        {isMenuOpen && (
                            <div className={cn(
                                "absolute top-full mt-1 bg-card glass border border-border/50 rounded-2xl neo-shadow overflow-hidden min-w-[150px] animate-in zoom-in-95 duration-200 z-50",
                                isOwn ? "right-0" : "left-0"
                            )}>
                                <div className="p-1.5 space-y-0.5 flex flex-col items-stretch text-left">
                                    <button
                                        onClick={() => handleAction('reply')}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/10 text-foreground transition-colors text-xs font-bold"
                                    >
                                        <Reply size={14} className="text-primary" />
                                        <span>Trả lời</span>
                                    </button>
                                    <button
                                        onClick={() => handleAction('copy')}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/10 text-foreground transition-colors text-xs font-bold"
                                    >
                                        <Copy size={14} className="text-primary" />
                                        <span>Sao chép</span>
                                    </button>
                                    {isOwn && (
                                        <>
                                            <div className="h-px bg-border/50 my-1 mx-2" />
                                            <button
                                                onClick={() => handleAction('delete')}
                                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-destructive/10 text-destructive transition-colors text-xs font-bold"
                                            >
                                                <Trash2 size={14} />
                                                <span>Xóa bộ nhớ</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Reactions Display */}
                {message.reactions && message.reactions.length > 0 && (
                    <div className={cn("px-2", isOwn ? "flex justify-end" : "")}>
                        <ReactionDisplay
                            reactions={message.reactions}
                            conversationId={message.conversationId}
                            messageId={message.messageId}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
