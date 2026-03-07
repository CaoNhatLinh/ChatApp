import React from 'react';
import { X, Users, Search, Image as ImageIcon, FileText, Bell, Trash2, LogOut, ChevronRight, Palette, Edit3, Ban, ShieldOff } from 'lucide-react';
import { useMessenger } from '@/features/messenger/hooks/useMessenger';
import { useFriendStore } from '@/store/friendStore';
import { useAuthStore } from '@/store/authStore';
import { friendApi } from '@/api/friendApi';

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

    const activeConv = conversations?.find(c => c.conversationId === activeConversationId);

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
        if (!confirm('Ban co chac chan muon chan nguoi dung nay?')) return;
        await blockFriend(currentUser.userId, activeConv.otherParticipant.userId);
        setBlockStatus({ hasBlocked: true, isBlockedBy: blockStatus?.isBlockedBy ?? false });
        void fetchBlockedUsers(currentUser.userId);
    };

    const handleUnblock = async () => {
        if (!currentUser?.userId || !activeConv?.otherParticipant?.userId) return;
        await unblockFriend(currentUser.userId, activeConv.otherParticipant.userId);
        setBlockStatus({ hasBlocked: false, isBlockedBy: blockStatus?.isBlockedBy ?? false });
        void fetchBlockedUsers(currentUser.userId);
    };

    if (!isOpen || !activeConv) return null;

    return (
        <div className="w-[300px] border-l border-border/50 bg-background/50 flex flex-col h-full animate-in slide-in-from-right-4 duration-300 z-20">
            {/* Header */}
            <div className="h-20 border-b border-border/50 px-4 flex items-center justify-between glass sticky top-0">
                <h3 className="text-lg font-black uppercase tracking-tight">Thông tin</h3>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-primary/10 rounded-xl text-muted-foreground hover:text-primary transition-all"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                {/* Profile Overview */}
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-background bg-primary/10 flex items-center justify-center neo-shadow relative group">
                        {activeConv.otherParticipant?.avatarUrl ? (
                            <img src={activeConv.otherParticipant.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-4xl font-black text-primary uppercase">{activeConv.name.charAt(0)}</span>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                            <ImageIcon size={24} className="text-white" />
                        </div>
                    </div>
                    <div className="w-full px-4">
                        {isRenaming ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={newChatName}
                                    onChange={(e) => setNewChatName(e.target.value)}
                                    className="flex-1 bg-background/50 border-2 border-primary rounded-xl py-1 px-3 outline-none text-center font-bold"
                                    autoFocus
                                    onBlur={() => setIsRenaming(false)}
                                // Placeholder for saving: onKeyDown={(e) => e.key === 'Enter' && saveName() }
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2 group cursor-pointer" onClick={() => { setIsRenaming(true); setNewChatName(activeConv.name); }}>
                                <h2 className="text-xl font-black uppercase tracking-tight">{activeConv.name}</h2>
                                <Edit3 size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        )}
                        {activeConv.type === 'dm' && activeConv.otherParticipant && (
                            <p className="text-xs font-bold text-primary uppercase tracking-widest mt-1">@{activeConv.otherParticipant.userName}</p>
                        )}
                    </div>
                </div>

            </div>

            {/* Main Actions */}
            <div className="flex justify-center gap-4">
                <button className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all flex-1">
                    <div className="bg-background rounded-full p-2 neo-shadow border border-border/50">
                        <Search size={18} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Tìm kiếm</span>
                </button>
                <button className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all flex-1">
                    <div className="bg-background rounded-full p-2 neo-shadow border border-border/50">
                        <Bell size={18} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Tắt âm</span>
                </button>
            </div>

            <div className="h-px w-full bg-border/50" />

            {/* Customization Options */}
            <div className="space-y-2">
                <button className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-background/80 transition-all group">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-xl">
                            <Palette size={18} />
                        </div>
                        <span className="font-bold text-sm">Chủ đề & Màu sắc</span>
                    </div>
                    <div className="w-4 h-4 rounded-full bg-primary neo-shadow" />
                </button>
            </div>

            <div className="h-px w-full bg-border/50" />

            {/* Media & Files */}
            <div className="space-y-2">
                <button className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-background/80 transition-all group">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-xl">
                            <ImageIcon size={18} />
                        </div>
                        <span className="font-bold text-sm">Ảnh & Video</span>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-background/80 transition-all group">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-xl">
                            <FileText size={18} />
                        </div>
                        <span className="font-bold text-sm">Tài liệu</span>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
                {activeConv.type === 'group' && (
                    <button className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-background/80 transition-all group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 text-primary rounded-xl">
                                <Users size={18} />
                            </div>
                            <span className="font-bold text-sm">Thành viên ({activeConv.memberCount})</span>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                )}
            </div>

            <div className="h-px w-full bg-border/50" />

            {/* Danger Zone */}
            <div className="space-y-2">
                {/* Block/Unblock for DM */}
                {activeConv.type === 'dm' && activeConv.otherParticipant && (
                    blockStatus?.hasBlocked ? (
                        <button
                            onClick={() => void handleUnblock()}
                            className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-primary/10 text-primary transition-all group"
                        >
                            <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <ShieldOff size={18} />
                            </div>
                            <span className="font-bold text-sm">Bo chan nguoi dung</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => void handleBlock()}
                            className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-destructive/10 text-destructive transition-all group"
                        >
                            <div className="p-2 bg-destructive/10 rounded-xl group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                                <Ban size={18} />
                            </div>
                            <span className="font-bold text-sm">Chan nguoi dung</span>
                        </button>
                    )
                )}

                <button className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-destructive/10 text-destructive transition-all group">
                    <div className="p-2 bg-destructive/10 rounded-xl group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                        <Trash2 size={18} />
                    </div>
                    <span className="font-bold text-sm">Xoa lich su</span>
                </button>
                {activeConv.type === 'group' && (
                    <button className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-destructive/10 text-destructive transition-all group">
                        <div className="p-2 bg-destructive/10 rounded-xl group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                            <LogOut size={18} />
                        </div>
                        <span className="font-bold text-sm">Roi nhom</span>
                    </button>
                )}
            </div>
        </div>
    );
};
