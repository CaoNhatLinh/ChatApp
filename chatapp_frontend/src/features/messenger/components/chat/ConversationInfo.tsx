import React from 'react';
import { X, Ban, ShieldOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMessenger } from '@/features/messenger/model/useMessenger';
import type { Conversation } from '@/features/messenger/types/messenger.types';
import { useFriendStore } from '@/features/relationships/model/friend.store';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { friendApi } from '@/features/relationships/api/friends.api';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import { InviteManager } from './InviteManager';
import { localizeText } from '@/shared/i18n';

interface ConversationInfoProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ConversationInfo: React.FC<ConversationInfoProps> = ({ isOpen, onClose }) => {
    const { conversations, activeConversationId } = useMessenger();

    // UI states for new features
    const [blockStatus, setBlockStatus] = React.useState<{ hasBlocked: boolean; isBlockedBy: boolean } | null>(null);

    const { user: currentUser } = useAuthStore();
    const { blockFriend, unblockFriend, fetchBlockedUsers } = useFriendStore();

    const activeConv = conversations?.find((c: Conversation) => c.conversationId === activeConversationId);

    // Fetch block status for DM conversations
    React.useEffect(() => {
        if (isOpen && activeConv?.type === 'dm' && activeConv.otherParticipant?.userId) {
            friendApi.checkBlockStatus(activeConv.otherParticipant.userId)
                .then(setBlockStatus)
                .catch(err => console.error('[ConversationInfo] Block check failed:', err));
        }
    }, [isOpen, activeConv?.conversationId, activeConv?.type, activeConv?.otherParticipant?.userId]);

    const handleBlock = async () => {
        if (!currentUser?.userId || !activeConv?.otherParticipant?.userId) return;
        if (!confirm(MESSENGER_COPY.conversationInfo.confirmBlock)) return;
        await blockFriend(activeConv.otherParticipant.userId);
        setBlockStatus({ hasBlocked: true, isBlockedBy: blockStatus?.isBlockedBy ?? false });
        void fetchBlockedUsers();
    };

    const handleUnblock = async () => {
        if (!currentUser?.userId || !activeConv?.otherParticipant?.userId) return;
        await unblockFriend(activeConv.otherParticipant.userId);
        setBlockStatus({ hasBlocked: false, isBlockedBy: blockStatus?.isBlockedBy ?? false });
        void fetchBlockedUsers();
    };

    if (!isOpen || !activeConv) return null;

    return (
        <motion.div
            className="w-[300px] border-l border-border/50 bg-background/50 flex flex-col h-full z-20"
            initial={UI_MOTION_CONFIG.initialState}
            animate={UI_MOTION_CONFIG.animateState}
            variants={UI_MOTION_VARIANTS.slideInFromRight}
        >
            {/* Header */}
            <div className="h-20 border-b border-border/50 px-4 flex items-center justify-between glass sticky top-0">
                <h3 className="text-lg font-black uppercase tracking-tight">{MESSENGER_COPY.conversationInfo.title}</h3>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-[color,background-color,border-color,box-shadow,transform,opacity]"
                >
                    <X size={20} />
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                {/* Profile Overview */}
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="relative group">
                        <Avatar className="w-24 h-24 rounded-3xl border-4 border-background neo-shadow transition-transform hover:scale-105">
                            <AvatarImage src={activeConv.otherParticipant?.avatarUrl} />
                            <AvatarFallback className="bg-primary/10 text-primary text-4xl font-black uppercase">
                                {activeConv.name.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                    </div>

                    <div className="w-full px-2">
                        <div className="flex items-center justify-center gap-2 rounded-xl p-2">
                            <h2 className="text-xl font-black uppercase tracking-tight break-all">{activeConv.name}</h2>
                        </div>
                        {activeConv.type === 'dm' && activeConv.otherParticipant && (
                            <p className="text-xs font-bold text-primary uppercase tracking-widest mt-1">@{activeConv.otherParticipant.userName}</p>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    {activeConv.type !== 'dm' && (
                        <div>
                            <h4 className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest mb-3 px-1">{localizeText('Lời mời & yêu cầu tham gia')}</h4>
                            <InviteManager conversationId={activeConv.conversationId} />
                        </div>
                    )}
                    {/* Danger Zone */}
                    <div>
                        <h4 className="text-[10px] font-black uppercase text-destructive tracking-widest mb-3 px-1">
                            {MESSENGER_COPY.conversationInfo.dangerZone}
                        </h4>
                        <div className="space-y-1">
                            {activeConv.type === 'dm' && activeConv.otherParticipant && (
                                blockStatus?.hasBlocked ? (
                                    <button
                                        onClick={() => void handleUnblock()}
                                        className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-primary/10 text-primary transition-[color,background-color,border-color,box-shadow,transform,opacity] group"
                                    >
                                        <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                            <ShieldOff size={18} />
                                        </div>
                                        <span className="font-bold text-sm">{MESSENGER_COPY.conversationInfo.unblockUser}</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => void handleBlock()}
                                        className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-destructive/10 text-destructive transition-[color,background-color,border-color,box-shadow,transform,opacity] group"
                                    >
                                        <div className="p-2 bg-destructive/10 rounded-xl group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                                            <Ban size={18} />
                                        </div>
                                        <span className="font-bold text-sm">{MESSENGER_COPY.conversationInfo.blockUser}</span>
                                    </button>
                                )
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

