import React from 'react';
import type { Conversation } from '../../types/messenger.types';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/common/lib/utils';
import { usePresence } from '@/store/presenceStore';
import { StatusDot } from '@/components/presence/StatusSelector';
import { Pin, PinOff } from 'lucide-react';
import { useFriendStore } from '@/store/friendStore';

interface ConversationItemProps {
    conversation: Conversation;
    isActive: boolean;
    onClick: () => void;
    onPin?: (id: string) => void;
    onUnpin?: (id: string) => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
    conversation,
    isActive,
    onClick,
    onPin,
    onUnpin
}) => {
    const lastMsg = conversation.lastMessage;
    const isDM = conversation.type === 'dm';
    const otherUser = conversation.otherParticipant;
    const isPinned = conversation.isPinned;
    const { presence: otherPresence } = usePresence(otherUser?.userId ?? '');
    const isOtherOnline = otherPresence?.isOnline ?? false;
    const otherStatus = otherPresence?.status ?? 'OFFLINE';

    // Check if the sender of the last message is blocked
    const blockedUserIds = useFriendStore(state => state.blockedUserIds);
    const isLastMsgBlocked = lastMsg?.senderId ? blockedUserIds.has(lastMsg.senderId) : false;

    const handlePinClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPinned) {
            onUnpin?.(conversation.conversationId);
        } else {
            onPin?.(conversation.conversationId);
        }
    };

    return (
        <div className="relative group">
            <button
                onClick={onClick}
                className={cn(
                    "w-full p-3 rounded-2xl flex items-center gap-3 transition-all duration-200 relative overflow-hidden",
                    isActive
                        ? "bg-primary text-primary-foreground neo-shadow translate-x-1"
                        : "hover:bg-background/60 text-foreground"
                )}
            >
                {/* Avatar Container */}
                <div className="relative flex-shrink-0">
                    <div className={cn(
                        "w-12 h-12 rounded-2xl overflow-hidden border-2 transition-all duration-300",
                        isActive ? "border-primary-foreground/50" : "border-border group-hover:border-primary/50"
                    )}>
                        {isDM && otherUser?.avatarUrl ? (
                            <img src={otherUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className={cn(
                                "w-full h-full flex items-center justify-center font-black text-lg",
                                isActive ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"
                            )}>
                                {conversation.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    {/* Status Indicator for DM */}
                    {isDM && (
                        <StatusDot
                            status={otherStatus}
                            isOnline={isOtherOnline}
                            size="md"
                            className={cn(
                                "absolute bottom-[-2px] right-[-2px] border-2 shadow-sm rounded-full",
                                isActive ? "border-primary" : "border-background"
                            )}
                        />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 text-left">
                    <div className="flex justify-between items-baseline mb-0.5">
                        <div className="flex items-center gap-1 min-w-0">
                            <h4 className="font-black text-sm truncate uppercase tracking-tight">
                                {conversation.name}
                            </h4>
                            {isPinned && <Pin size={10} className={cn(isActive ? "text-primary-foreground/70" : "text-primary")} />}
                        </div>
                        {lastMsg && (
                            <span className={cn(
                                "text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ml-2",
                                isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                            )}>
                                {(() => {
                                    try {
                                        const dateInput = lastMsg.createdAt as unknown as string | number | Date;
                                        return formatDistanceToNow(new Date(dateInput), { addSuffix: false, locale: vi });
                                    } catch {
                                        return '';
                                    }
                                })()}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 overflow-hidden">
                        <p className={cn(
                            "text-xs truncate font-medium",
                            isActive ? "text-primary-foreground/80" : "text-muted-foreground/80"
                        )}>
                            {lastMsg ? (
                                isLastMsgBlocked && !isDM ? (
                                    <span className="italic opacity-70">Tin nhắn từ người dùng đã chặn</span>
                                ) : (
                                    <>
                                        {lastMsg.senderName && <span className="font-bold">{lastMsg.senderName}: </span>}
                                        {lastMsg.content}
                                    </>
                                )
                            ) : (
                                <span className="italic opacity-60">Chưa có tin nhắn...</span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Active Indicator Line */}
                {isActive && (
                    <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary-foreground rounded-full" />
                )}
            </button>

            {/* Pin Action Button - Hover Only */}
            <button
                onClick={handlePinClick}
                className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-background/80 neo-shadow opacity-0 group-hover:opacity-100 transition-all duration-200 z-10",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
                )}
                title={isPinned ? "Bỏ ghim" : "Ghim hội thoại"}
            >
                {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
        </div>
    );
};
