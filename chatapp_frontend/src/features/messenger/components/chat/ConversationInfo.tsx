import React from 'react';
import { X, Users, Search, Image as ImageIcon, FileText, Bell, Trash2, LogOut, ChevronRight, Palette, Edit3, Ban, ShieldOff } from 'lucide-react';
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

interface ConversationInfoProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ConversationInfo: React.FC<ConversationInfoProps> = ({ isOpen, onClose }) => {
    const { conversations, activeConversationId } = useMessenger();

    // UI states for new features
    const [isRenaming, setIsRenaming] = React.useState(false);
    const [newChatName, setNewChatName] = React.useState('');
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
                    className="rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
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
                            <AvatarImage src={activeConv.otherParticipant?.avatarUrl || ''} />
                            <AvatarFallback className="bg-primary/10 text-primary text-4xl font-black uppercase">
                                {activeConv.name.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-3xl">
                            <ImageIcon size={24} className="text-white" />
                        </div>
                    </div>

                    <div className="w-full px-2">
                        {isRenaming ? (
                        <motion.input
                            type="text"
                            value={newChatName}
                            onChange={(e) => setNewChatName(e.target.value)}
                            className="w-full bg-background/50 border-2 border-primary rounded-xl py-2 px-3 outline-none text-center font-bold"
                            autoFocus
                            onBlur={() => setIsRenaming(false)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') setIsRenaming(false);
                                if (e.key === 'Escape') setIsRenaming(false);
                            }}
                            initial={UI_MOTION_CONFIG.initialState}
                            animate={UI_MOTION_CONFIG.animateState}
                            variants={UI_MOTION_VARIANTS.zoomReveal}
                        />
                        ) : (
                            <div
                                className="flex items-center justify-center gap-2 group cursor-pointer hover:bg-primary/5 rounded-xl p-2 transition-colors"
                                onClick={() => { setIsRenaming(true); setNewChatName(activeConv.name); }}
                            >
                                <h2 className="text-xl font-black uppercase tracking-tight break-all">{activeConv.name}</h2>
                                <Edit3 size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </div>
                        )}
                        {activeConv.type === 'dm' && activeConv.otherParticipant && (
                            <p className="text-xs font-bold text-primary uppercase tracking-widest mt-1">@{activeConv.otherParticipant.userName}</p>
                        )}
                    </div>
                </div>

                {/* Main Actions */}
                <div className="flex justify-around gap-2">
                    <button className="flex flex-col items-center gap-2 p-2 rounded-2xl hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all flex-1">
                        <div className="bg-background rounded-xl p-2.5 neo-shadow border border-border/50">
                            <Search size={18} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                            {MESSENGER_COPY.conversationInfo.search}
                        </span>
                    </button>
                    <button className="flex flex-col items-center gap-2 p-2 rounded-2xl hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all flex-1">
                        <div className="bg-background rounded-xl p-2.5 neo-shadow border border-border/50">
                            <Bell size={18} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                            {MESSENGER_COPY.conversationInfo.mute}
                        </span>
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Customization */}
                    <div>
                        <h4 className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest mb-3 px-1">
                            {MESSENGER_COPY.conversationInfo.customization}
                        </h4>
                        <button className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-primary/5 transition-all group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    <Palette size={18} />
                                </div>
                                <span className="font-bold text-sm">{MESSENGER_COPY.conversationInfo.themeLabel}</span>
                            </div>
                            <div className="w-4 h-4 rounded-full bg-primary neo-shadow" />
                        </button>
                    </div>

                    {/* Shared Media */}
                    <div>
                        <h4 className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest mb-3 px-1">
                            {MESSENGER_COPY.conversationInfo.mediaLabel}
                        </h4>
                        <div className="space-y-1">
                            <button className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-primary/5 transition-all group text-left">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                        <ImageIcon size={18} />
                                    </div>
                                    <span className="font-bold text-sm">{MESSENGER_COPY.conversationInfo.photoVideoLabel}</span>
                                </div>
                                <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-all" />
                            </button>
                            <button className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-primary/5 transition-all group text-left">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                        <FileText size={18} />
                                    </div>
                                    <span className="font-bold text-sm">{MESSENGER_COPY.conversationInfo.documentsLabel}</span>
                                </div>
                                <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-all" />
                            </button>
                            {activeConv.type === 'group' && (
                                <button className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-primary/5 transition-all group text-left">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                            <Users size={18} />
                                        </div>
                                        <span className="font-bold text-sm">
                                            {MESSENGER_COPY.conversationInfo.memberLabel} ({activeConv.memberCount})
                                        </span>
                                    </div>
                                    <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-all" />
                                </button>
                            )}
                        </div>
                    </div>

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
                                        className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-primary/10 text-primary transition-all group"
                                    >
                                        <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                            <ShieldOff size={18} />
                                        </div>
                                        <span className="font-bold text-sm">{MESSENGER_COPY.conversationInfo.unblockUser}</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => void handleBlock()}
                                        className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-destructive/10 text-destructive transition-all group"
                                    >
                                        <div className="p-2 bg-destructive/10 rounded-xl group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                                            <Ban size={18} />
                                        </div>
                                        <span className="font-bold text-sm">{MESSENGER_COPY.conversationInfo.blockUser}</span>
                                    </button>
                                )
                            )}

                            <button className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-destructive/10 text-destructive transition-all group">
                                <div className="p-2 bg-destructive/10 rounded-xl group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                                    <Trash2 size={18} />
                                </div>
                                <span className="font-bold text-sm">{MESSENGER_COPY.conversationInfo.deleteHistory}</span>
                            </button>
                            {activeConv.type === 'group' && (
                                <button className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-destructive/10 text-destructive transition-all group">
                                    <div className="p-2 bg-destructive/10 rounded-xl group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                                        <LogOut size={18} />
                                    </div>
                                    <span className="font-bold text-sm">{MESSENGER_COPY.conversationInfo.leaveGroup}</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
