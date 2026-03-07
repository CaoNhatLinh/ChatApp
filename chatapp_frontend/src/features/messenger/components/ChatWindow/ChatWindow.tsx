import React, { useRef, useEffect, useMemo } from 'react';
import { useMessenger } from '@/features/messenger/hooks/useMessenger';
import {
    useMessengerStore,
    EMPTY_MESSAGES
} from '@/store/messengerStore';
import { MessageItem } from '@/features/messenger/components/ChatWindow/MessageItem';
import { MessageInput } from '@/features/messenger/components/MessageInput/MessageInput';
import { ConversationInfo } from './ConversationInfo';
import { Phone, Video, Info, MessageCircle, ChevronLeft, Loader2 } from 'lucide-react';
import type { Message, Conversation } from '@/features/messenger/types/messenger.types';
import { useShallow } from 'zustand/react/shallow';
import { usePresence } from '@/store/presenceStore';
import { StatusDot } from '@/components/presence/StatusSelector';
import { useTrackPresence } from '@/hooks/presence/useTrackPresence';
import { UserProfileModal } from '@/components/user/UserProfileModal';
import { getUserProfile } from '@/api/userApi';
import { useFriendStore } from '@/store/friendStore';
import { useAuthStore } from '@/store/authStore';
import type { UserProfileModal as UserProfile } from '@/types/roomActions';

export const ChatWindow: React.FC = () => {
    const {
        conversations,
        activeConversationId,
        setSidebarOpen,
        loadMoreMessages,
        loading,
        typingUsers,
        sendMessage
    } = useMessenger();

    const messages = useMessengerStore(useShallow(state =>
        activeConversationId ? (state.messages[activeConversationId] || EMPTY_MESSAGES) : EMPTY_MESSAGES
    ));
    const messagesPagination = useMessengerStore(state => state.messagesPagination);

    const [isInfoOpen, setIsInfoOpen] = React.useState(false);
    const [toastMessage, setToastMessage] = React.useState<string | null>(null);

    // Profile Modal State
    const [isProfileModalOpen, setIsProfileModalOpen] = React.useState(false);
    const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
    const [selectedUserProfile, setSelectedUserProfile] = React.useState<UserProfile | undefined>();
    const [loadingProfile, setLoadingProfile] = React.useState(false);

    // Block state - for filtering messages in group chats
    const blockedUserIds = useFriendStore(state => state.blockedUserIds);
    const fetchBlockedUsers = useFriendStore(state => state.fetchBlockedUsers);
    const { user: currentUser } = useAuthStore();

    // Load blocked users on mount
    useEffect(() => {
        if (currentUser?.userId) {
            void fetchBlockedUsers(currentUser.userId);
        }
    }, [currentUser?.userId, fetchBlockedUsers]);

    const handleUserClick = async (userId: string) => {
        setSelectedUserId(userId);
        setIsProfileModalOpen(true);
        setLoadingProfile(true);
        try {
            const profile = await getUserProfile(userId);
            setSelectedUserProfile(profile as unknown as UserProfile);
        } catch (error) {
            console.error('Failed to fetch user profile:', error);
        } finally {
            setLoadingProfile(false);
        }
    };

    const pagination = activeConversationId ? messagesPagination[activeConversationId] : null;

    const activeConv = useMemo(() =>
        conversations?.find((c: Conversation) => c.conversationId === activeConversationId),
        [conversations, activeConversationId]
    );

    // Track presence for DM other participant (works for non-friends too)
    const otherUserId = activeConv?.type === 'dm' ? activeConv.otherParticipant?.userId : undefined;
    const trackIds = useMemo(() => otherUserId ? [otherUserId] : [], [otherUserId]);
    useTrackPresence(trackIds);
    const { presence: otherPresence } = usePresence(otherUserId ?? '');
    const isOtherOnline = otherPresence?.isOnline ?? false;
    const otherStatus = otherPresence?.status ?? 'OFFLINE';

    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logic
    const lastMessageId = messages.length > 0 ? messages[messages.length - 1].messageId : null;

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [lastMessageId, typingUsers]);

    const showFeaturePlaceholder = (featureName: string) => {
        setToastMessage(`Tính năng ${featureName} đang phát triển`);
        setTimeout(() => setToastMessage(null), 3000);
    };

    if (!activeConv) {
        return (
            <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
                <div className="glass p-12 rounded-[3rem] neo-shadow flex flex-col items-center gap-6 max-w-sm">
                    <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary animate-bounce">
                        <MessageCircle size={48} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Chọn một cuộc trò chuyện</h3>
                        <p className="text-muted-foreground text-sm font-medium">Bắt đầu kết nối với bạn bè của bạn trong không gian trò chuyện mới.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full flex z-10 animate-in slide-in-from-right-4 duration-500 overflow-hidden relative">

            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${isInfoOpen ? 'mr-[300px]' : ''}`}>
                {/* Chat Header */}
                <div className="h-20 border-b border-border/50 px-6 flex items-center justify-between glass">
                    <div className="flex items-center gap-4">
                        {/* Back button for mobile */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="md:hidden p-2 -ml-2 hover:bg-primary/10 rounded-xl text-primary transition-all"
                        >
                            <ChevronLeft size={24} />
                        </button>

                        <div className="relative">
                            <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-primary/30">
                                {activeConv.otherParticipant?.avatarUrl ? (
                                    <img src={activeConv.otherParticipant.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-primary/10 flex items-center justify-center font-black text-primary uppercase">
                                        {activeConv.name.charAt(0)}
                                    </div>
                                )}
                            </div>
                            {activeConv.type === 'dm' && (
                                <StatusDot
                                    status={otherStatus}
                                    isOnline={isOtherOnline}
                                    size="md"
                                    className="absolute bottom-[-2px] right-[-2px] border-2 border-background shadow-sm rounded-full"
                                />
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-1">{activeConv.name}</h3>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {activeConv.type === 'dm' ? (isOtherOnline ? (otherStatus === 'DND' ? 'Không làm phiền' : 'Trực tuyến') : 'Ngoại tuyến') : `${activeConv.memberCount} thành viên`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => showFeaturePlaceholder('Gọi thoại')}
                            className="p-3 hover:bg-primary/10 rounded-2xl text-muted-foreground hover:text-primary transition-all"
                            title="Gọi thoại"
                        >
                            < Phone size={20} />
                        </button>
                        <button
                            onClick={() => showFeaturePlaceholder('Gọi Video')}
                            className="p-3 hover:bg-primary/10 rounded-2xl text-muted-foreground hover:text-primary transition-all"
                            title="Gọi Video"
                        >
                            < Video size={20} />
                        </button>
                        <button
                            onClick={() => setIsInfoOpen(!isInfoOpen)}
                            className={`p-3 rounded-2xl transition-all ${isInfoOpen ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 text-muted-foreground hover:text-primary'}`}
                            title="Thông tin cuộc hội thoại"
                        >
                            < Info size={20} />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-gradient-to-b from-transparent to-background/20"
                >
                    {/* Load More Messages */}
                    {pagination?.hasNext && (
                        <div className="flex justify-center pb-4">
                            <button
                                onClick={() => activeConversationId && void loadMoreMessages(activeConversationId)}
                                disabled={loading}
                                className="px-6 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition-all flex items-center gap-2"
                            >
                                {loading ? <Loader2 size={12} className="animate-spin" /> : 'Tải thêm tin nhắn cũ'}
                            </button>
                        </div>
                    )}

                    {messages?.map((msg: Message, idx: number) => {
                        const prevMessage = idx > 0 ? messages[idx - 1] : null;
                        const showAvatar = Boolean(idx === 0 || (prevMessage && prevMessage.sender.userId !== msg.sender.userId));

                        const isBlocked = activeConv.type !== 'dm' && (
                            msg.senderBlockedByViewer || blockedUserIds.has(msg.sender.userId)
                        );

                        return (
                            <MessageItem
                                key={msg.messageId}
                                message={msg}
                                showAvatar={showAvatar}
                                isBlocked={isBlocked}
                                onAction={(action) => showFeaturePlaceholder(`Hanh dong tin nhan: ${action}`)}
                                onUserClick={handleUserClick}
                                onRetry={async (messageId) => {
                                    if (!activeConversationId) return;
                                    const messageToRetry = messages.find((m: Message) => m.messageId === messageId);
                                    if (messageToRetry) {
                                        useMessengerStore.getState().removeMessage(activeConversationId, messageId);
                                        await sendMessage(messageToRetry.content, messageToRetry.type);
                                    }
                                }}
                            />
                        );
                    })}

                    {/* Typing Indicators */}
                    {typingUsers && typingUsers.filter(tu => !blockedUserIds.has(tu.user.userId)).length > 0 && (
                        <div className="flex items-center gap-2 text-muted-foreground pl-14 animate-in fade-in slide-in-from-left-2">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider">
                                {(() => {
                                    const visibleTypingUsers = typingUsers.filter(tu => !blockedUserIds.has(tu.user.userId));
                                    return visibleTypingUsers.length === 1
                                        ? `${visibleTypingUsers[0].user.displayName} đang nhập...`
                                        : `${visibleTypingUsers.length} người đang nhập...`;
                                })()}
                            </span>
                        </div>
                    )}
                </div>

                {/* Message Input Area */}
                <div className="p-6">
                    <MessageInput />
                </div>
            </div>

            {/* Profile Modal */}
            <UserProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                userId={selectedUserId || ''}
                userProfile={selectedUserProfile}
                isLoading={loadingProfile}
                onSendMessage={() => setIsProfileModalOpen(false)}
                onBlock={() => {
                    // Refresh blocked users after blocking
                    if (currentUser?.userId) void fetchBlockedUsers(currentUser.userId);
                    setIsProfileModalOpen(false);
                }}
                onUnblock={() => {
                    // Refresh blocked users after unblocking
                    if (currentUser?.userId) void fetchBlockedUsers(currentUser.userId);
                }}
            />

            {/* Conversation Info Sidebar */}
            <div className={`absolute top-0 right-0 h-full transition-transform duration-300 ${isInfoOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <ConversationInfo
                    isOpen={isInfoOpen}
                    onClose={() => setIsInfoOpen(false)}
                />
            </div>

            {/* Toast Notification */}
            {toastMessage && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="bg-card glass border border-border/50 neo-shadow px-6 py-3 rounded-2xl flex items-center gap-3">
                        < Info size={18} className="text-primary" />
                        <span className="font-bold text-sm tracking-wide">{toastMessage}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
