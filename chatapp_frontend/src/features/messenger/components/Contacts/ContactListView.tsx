import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, MessageSquare, Loader2, UserPlus, Check, X, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { getFriends, getReceivedRequests, acceptFriendRequest, rejectFriendRequest, sendFriendRequest, type FriendDTO, type FriendRequestsResponse } from '../../api/friends.api';
import { searchUsers } from '../../api/users.api';
import { useAuthStore } from '@/store/authStore';
import { useTrackPresence } from '@/hooks/presence/useTrackPresence';
import { usePresence } from '@/store/presenceStore';
import { StatusDot } from '@/components/presence/StatusSelector';
import { useMessenger } from '@/features/messenger/hooks/useMessenger';
import { findDmConversation, createConversation } from '@/api/conversationApi';
import { useMessengerStore } from '@/store/messengerStore';
import type { ConversationRequest } from '@/types/conversation';
import { getUserProfile } from '@/api/userApi';
import { UserProfileModal } from '@/components/user/UserProfileModal';
import type { UserProfileModal as UserProfile } from '@/types/roomActions';
import { unfriend } from '../../api/friends.api';
import { friendWsService } from '@/services/ws/friendWsService';
import type { User } from '@/features/auth/types/auth.types';

type TabType = 'friends' | 'requests' | 'add';
type SearchResult = User & { requestSent?: boolean };

const ContactRow: React.FC<{
    userId: string;
    displayName: string;
    userName: string;
    avatarUrl?: string;
    onUserClick: (id: string) => void;
    actions: React.ReactNode;
    subtitle?: string;
}> = ({ userId, displayName, userName, avatarUrl, onUserClick, actions, subtitle }) => {
    const { presence } = usePresence(userId);
    const isOnline = presence?.isOnline ?? false;
    const status = presence?.status ?? 'OFFLINE';
    return (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-card/40 hover:bg-card/80 border border-border/50 transition-all group cursor-pointer neo-shadow-sm">
            <div className="flex items-center gap-4" onClick={() => onUserClick(userId)}>
                <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center font-black text-primary text-lg uppercase overflow-hidden">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                            (displayName || userName || "?").charAt(0)
                        )}
                    </div>
                    <StatusDot
                        status={status}
                        isOnline={isOnline}
                        size="md"
                        className="absolute bottom-[-1px] right-[-1px] border-2 border-background"
                    />
                </div>
                <div>
                    <p className="font-bold text-lg">{displayName || userName}</p>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">@{userName}</p>
                        {subtitle ? (
                            <span className="text-[10px] font-bold text-primary uppercase">{subtitle}</span>
                        ) : (
                            <>
                                <StatusDot
                                    status={status}
                                    isOnline={isOnline}
                                    size="sm"
                                    className="w-1.5 h-1.5"
                                />
                                <span className="text-[10px] font-bold uppercase tracking-tighter opacity-60">
                                    {isOnline ? (status === 'DND' ? 'Không làm phiền' : 'Trực tuyến') : 'Ngoại tuyến'}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                {actions}
            </div>
        </div>
    );
};

export const ContactListView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('friends');
    const [searchQuery, setSearchQuery] = useState('');
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const { user } = useAuthStore();

    const [friends, setFriends] = useState<FriendDTO[]>([]);
    const [requests, setRequests] = useState<FriendRequestsResponse[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [hasNext, setHasNext] = useState(false);

    // Profile modal state
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | undefined>(undefined);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isProfileLoading, setIsProfileLoading] = useState(false);

    const handleUserClick = async (userId: string) => {
        setSelectedUserId(userId);
        setIsProfileModalOpen(true);
        setIsProfileLoading(true);
        try {
            const profile = await getUserProfile(userId);
            setUserProfile({
                userId: profile.userId,
                username: profile.userName,
                displayName: profile.displayName || profile.userName,
                avatarUrl: profile.avatarUrl,
                joinedAt: profile.createdAt,
                isOnline: profile.status === 'ONLINE',
                lastSeen: profile.lastActive || undefined
            });
        } catch (error) {
            console.error('Failed to fetch user profile:', error);
            toast.error('Không thể tải thông tin người dùng');
        } finally {
            setIsProfileLoading(false);
        }
    };

    const { selectConversation, setActiveView, hoistConversation } = useMessenger();
    const setGlobalRequestCount = useMessengerStore(state => state.setFriendRequestCount);

    const handleOpenChat = async (targetUserId: string) => {
        if (!user?.userId) return;
        try {
            let conversation;
            try {
                conversation = await findDmConversation(user.userId, targetUserId);
            } catch {
                conversation = await createConversation({
                    type: 'dm',
                    memberIds: [targetUserId]
                } as ConversationRequest);
            }

            // @ts-expect-error Different conversation types across modules
            hoistConversation(conversation);
            await selectConversation(conversation.conversationId);
            setActiveView('chat');
        } catch (error) {
            toast.error('Không thể mở cuộc trò chuyện');
            console.error(error);
        }
    };

    // Track presence for friends
    const friendIds = useMemo(() => friends.map(f => f.friendId), [friends]);
    useTrackPresence(friendIds);

    const fetchFriends = useCallback(async (pageNum: number, isNewTab = false) => {
        if (!user?.userId) return;
        setLoading(true);
        try {
            const response = await getFriends(pageNum, 30);
            if (isNewTab) {
                setFriends(response.content);
            } else {
                setFriends(prev => [...prev, ...response.content]);
            }
            setHasNext(response.hasNext);
            setPage(pageNum);
        } catch (error) {
            toast.error('Không thể tải danh sách bạn bè');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [user?.userId]);

    const fetchRequests = useCallback(async (pageNum: number, isNewTab = false) => {
        if (!user?.userId) return;
        setLoading(true);
        try {
            const response = await getReceivedRequests(user.userId, pageNum, 30);
            if (isNewTab) {
                setRequests(response.content);
            } else {
                // Pagination for requests might be different
            }
            setPage(pageNum);

            // Update global count
            if (isNewTab) {
                const total = response.content.reduce((acc, r) => acc + (r.userDetails?.length || 0), 0);
                setGlobalRequestCount(total);
            }
        } catch (error) {
            toast.error('Không thể tải lời mời kết bạn');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [user?.userId, setGlobalRequestCount]);

    const handleSearchUsers = useCallback(async (query: string) => {
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const results = await searchUsers(query);
            setSearchResults(results);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setSearching(false);
        }
    }, []);

    const handleSendRequest = async (targetId: string) => {
        try {
            await sendFriendRequest(targetId);
            toast.success('Đã gửi lời mời kết bạn');
            // Update UI locally
            setSearchResults(prev => prev.map(u => u.userId === targetId ? { ...u, requestSent: true } : u));
        } catch {
            toast.error('Khong the gui loi moi');
        }
    };

    useEffect(() => {
        setPage(0);
        if (activeTab === 'friends') {
            void fetchFriends(0, true);
        } else if (activeTab === 'requests') {
            void fetchRequests(0, true);
        }
    }, [activeTab, fetchFriends, fetchRequests]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeTab === 'add' && globalSearchQuery) {
                void handleSearchUsers(globalSearchQuery);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [globalSearchQuery, activeTab, handleSearchUsers]);

    const handleLoadMore = () => {
        if (activeTab === 'friends') {
            void fetchFriends(page + 1);
        } else {
            void fetchRequests(page + 1);
        }
    };

    const handleAccept = async (senderId: string) => {
        try {
            await acceptFriendRequest(senderId);
            toast.success('Đã chấp nhận lời mời');
            setRequests(prev => {
                const updated = prev.map(r => ({
                    ...r,
                    userDetails: r.userDetails?.filter(u => u.userId !== senderId)
                })).filter(r => (r.userDetails?.length || 0) > 0);

                // Update global count
                const total = updated.reduce((acc, r) => acc + (r.userDetails?.length || 0), 0);
                setGlobalRequestCount(total);

                return updated;
            });
            // Refresh friends list if on that tab
            if (activeTab === 'friends') void fetchFriends(0, true);
        } catch {
            toast.error('Lỗi khi chấp nhận lời mời');
        }
    };

    const handleReject = async (senderId: string) => {
        try {
            await rejectFriendRequest(senderId);
            toast.success('Đã từ chối lời mời');
            setRequests(prev => {
                const updated = prev.map(r => ({
                    ...r,
                    userDetails: r.userDetails?.filter(u => u.userId !== senderId)
                })).filter(r => (r.userDetails?.length || 0) > 0);

                // Update global count
                const total = updated.reduce((acc, r) => acc + (r.userDetails?.length || 0), 0);
                setGlobalRequestCount(total);

                return updated;
            });
        } catch {
            toast.error('Lỗi khi từ chối lời mời');
        }
    };

    const handleUnfriend = async (friendId: string) => {
        if (!confirm('Bạn có chắc chắn muốn huỷ kết bạn với người này?')) return;
        try {
            await unfriend(friendId);
            toast.success('Da huy ket ban');
            setFriends(prev => prev.filter(f => f.friendId !== friendId));
        } catch {
            toast.error('Khong the huy ket ban');
        }
    };

    useEffect(() => {
        if (user?.userId) {
            friendWsService.subscribeToFriendRequests((event) => {
                if (event.status === 'PENDING') {
                    // Refresh requests
                    void fetchRequests(0, true);
                    toast('Bạn có lời mời kết bạn mới!', { icon: '👋' });
                } else if (event.status === 'ACCEPTED' || event.status === 'UNFRIENDED') {
                    // Refresh both
                    void fetchFriends(0, true);
                    void fetchRequests(0, true);
                }
            });
        }
        return () => friendWsService.unsubscribe();
    }, [user?.userId, fetchFriends, fetchRequests]);

    return (
        <div className="h-full w-full flex flex-col bg-background relative z-10">
            {/* Header */}
            <div className="h-20 border-b border-border/50 px-6 flex items-center justify-between glass sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                        Danh bạ
                    </h2>

                    <div className="h-6 w-px bg-border/50 mx-2" />

                    {/* Tabs */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('friends')}
                            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === 'friends'
                                ? 'bg-primary text-primary-foreground neo-shadow'
                                : 'bg-transparent text-muted-foreground hover:bg-primary/10 hover:text-foreground'
                                }`}
                        >
                            Bạn bè
                        </button>
                        <button
                            onClick={() => setActiveTab('requests')}
                            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'requests'
                                ? 'bg-primary text-primary-foreground neo-shadow'
                                : 'bg-transparent text-muted-foreground hover:bg-primary/10 hover:text-foreground'
                                }`}
                        >
                            <span>Lời mời</span>
                            {requests.reduce((acc, r) => acc + (r.userDetails?.length || 0), 0) > 0 && (
                                <span className="bg-destructive text-destructive-foreground text-[10px] w-5 h-5 rounded-full flex items-center justify-center neo-shadow">
                                    {requests.reduce((acc, r) => acc + (r.userDetails?.length || 0), 0)}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('add')}
                            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'add'
                                ? 'bg-primary text-primary-foreground neo-shadow'
                                : 'bg-transparent text-muted-foreground hover:bg-primary/10 hover:text-foreground'
                                }`}
                        >
                            <UserPlus size={16} />
                            <span>Thêm bạn</span>
                        </button>
                    </div>
                </div>

                {/* Search (Friends page only) */}
                {activeTab === 'friends' && (
                    <div className="relative group w-64 hidden md:block">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                            <Search size={16} />
                        </div>
                        <input
                            type="text"
                            placeholder="Tìm kiếm bạn bè..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-background/50 border-2 border-border/30 rounded-2xl py-2 pl-10 pr-4 focus:ring-0 focus:border-primary focus:bg-background transition-all outline-none font-medium text-sm"
                        />
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10">

                <div className="max-w-4xl mx-auto">
                    {activeTab === 'friends' && (
                        <div className="space-y-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
                            <h3 className="font-bold text-muted-foreground uppercase tracking-widest text-xs mb-4">
                                Bạn bè ({friends.length})
                            </h3>

                            {friends.length === 0 && !loading ? (
                                <div className="text-center text-muted-foreground py-20 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-3xl">
                                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                                        <Search size={32} className="text-primary" />
                                    </div>
                                    <p className="font-bold">Không tìm thấy người bạn nào.</p>
                                    <p className="text-sm opacity-70 mt-1">Hãy bắt đầu kết bạn để trò chuyện!</p>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {friends.filter(f =>
                                        f.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        f.username?.toLowerCase().includes(searchQuery.toLowerCase())
                                    ).map((friend) => (
                                        <ContactRow
                                            key={friend.friendId}
                                            userId={friend.friendId}
                                            displayName={friend.displayName}
                                            userName={friend.username}
                                            avatarUrl={friend.avatarUrl}
                                            onUserClick={handleUserClick}
                                            actions={
                                                <div className="flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        className="p-3 bg-background hover:bg-primary/10 rounded-xl text-muted-foreground hover:text-primary transition-colors neo-shadow border border-border/50"
                                                        title="Nhắn tin"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void handleOpenChat(friend.friendId);
                                                        }}
                                                    >
                                                        <MessageSquare size={18} />
                                                    </button>
                                                    <button
                                                        className="p-3 bg-background hover:bg-destructive/10 rounded-xl text-muted-foreground hover:text-destructive transition-colors neo-shadow border border-border/50"
                                                        title="Huỷ kết bạn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void handleUnfriend(friend.friendId);
                                                        }}
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </div>
                                            }
                                        />
                                    ))}

                                    {hasNext && (
                                        <button
                                            onClick={handleLoadMore}
                                            disabled={loading}
                                            className="w-full py-4 rounded-2xl border-2 border-dashed border-border/50 text-muted-foreground font-bold hover:bg-primary/5 hover:border-primary/50 transition-all flex items-center justify-center gap-2"
                                        >
                                            {loading ? <Loader2 size={20} className="animate-spin" /> : 'Xem thêm bạn bè'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'add' && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-300">
                            <div className="glass p-8 rounded-[2.5rem] neo-shadow border-primary/20">
                                <h3 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-3">
                                    <UserPlus className="text-primary" /> Thêm bạn mới
                                </h3>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                                        <Search size={24} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Nhập tên người dùng hoặc email..."
                                        value={globalSearchQuery}
                                        onChange={(e) => setGlobalSearchQuery(e.target.value)}
                                        className="w-full bg-background/50 border-3 border-border/30 rounded-3xl py-5 pl-16 pr-6 focus:ring-0 focus:border-primary focus:bg-background transition-all outline-none font-bold text-lg neo-shadow-sm"
                                    />
                                    {searching && <Loader2 className="absolute right-6 top-6 animate-spin text-primary" size={24} />}
                                </div>
                                <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest ml-4 opacity-70">
                                    Mẹo: Tìm kiếm chính xác tên người dùng để có kết quả tốt nhất
                                </p>
                            </div>

                            <div className="space-y-4">
                                {searchResults.length > 0 ? (
                                    <div className="grid gap-4">
                                        <h4 className="font-bold text-muted-foreground uppercase tracking-widest text-xs px-2">Kết quả tìm kiếm ({searchResults.length})</h4>
                                        {searchResults.map((u) => (
                                            <ContactRow
                                                key={u.userId}
                                                userId={u.userId}
                                                displayName={u.displayName}
                                                userName={u.userName}
                                                avatarUrl={u.avatarUrl}
                                                onUserClick={handleUserClick}
                                                actions={
                                                    <div>
                                                        {u.userId === user?.userId ? (
                                                            <div className="flex items-center gap-2 px-6 py-3 bg-muted text-muted-foreground rounded-2xl text-xs font-black uppercase tracking-widest border border-border/50">
                                                                <UserIcon size={16} /> Bạn
                                                            </div>
                                                        ) : friends.some(f => f.friendId === u.userId) ? (
                                                            <div className="flex items-center gap-2 px-6 py-3 bg-primary/10 text-primary rounded-2xl text-xs font-black uppercase tracking-widest border border-primary/20">
                                                                <Check size={16} /> Bạn bè
                                                            </div>
                                                        ) : u.requestSent ? (
                                                            <div className="flex items-center gap-2 px-6 py-3 bg-muted text-muted-foreground rounded-2xl text-xs font-black uppercase tracking-widest">
                                                                <Check size={16} /> Đã gửi
                                                            </div>
                                                        ) : (
                                                            <button
                                                                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all neo-shadow"
                                                                onClick={() => void handleSendRequest(u.userId)}
                                                            >
                                                                <UserPlus size={16} /> Kết bạn
                                                            </button>
                                                        )}
                                                    </div>
                                                }
                                            />
                                        ))}
                                    </div>
                                ) : globalSearchQuery.length >= 2 && !searching ? (
                                    <div className="text-center py-20 bg-muted/20 rounded-[2.5rem] border-2 border-dashed border-border/50">
                                        <p className="font-bold text-muted-foreground">Không tìm thấy người dùng nào phù hợp</p>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}

                    {activeTab === 'requests' && (
                        <div className="space-y-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
                            <h3 className="font-bold text-muted-foreground uppercase tracking-widest text-xs mb-4">
                                Lời mời đang chờ ({requests.reduce((acc, r) => acc + (r.userDetails?.length || 0), 0)})
                            </h3>

                            {requests.length === 0 && !loading ? (
                                <div className="text-center text-muted-foreground py-20 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-3xl">
                                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                                        <UserPlus size={32} className="text-primary" />
                                    </div>
                                    <p className="font-bold">Không có lời mời kết bạn nào.</p>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {requests.map((req) => (
                                        <React.Fragment key={req.userId}>
                                            {req.userDetails?.map((u) => (
                                                <ContactRow
                                                    key={u.userId}
                                                    userId={u.userId}
                                                    displayName={u.displayName || u.userName}
                                                    userName={u.userName}
                                                    avatarUrl={u.avatarUrl}
                                                    onUserClick={handleUserClick}
                                                    subtitle="Đã gửi lời mời"
                                                    actions={
                                                        <div className="flex gap-2">
                                                            <button
                                                                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all neo-shadow"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    void handleAccept(u.userId);
                                                                }}
                                                            >
                                                                Chấp nhận
                                                            </button>
                                                            <button
                                                                className="px-5 py-2.5 bg-background text-foreground border border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-destructive hover:text-destructive-foreground hover:border-destructive hover:scale-105 active:scale-95 transition-all"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    void handleReject(u.userId);
                                                                }}
                                                            >
                                                                Từ chối
                                                            </button>
                                                        </div>
                                                    }
                                                />
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {loading && page === 0 && (
                        <div className="flex justify-center py-20">
                            <Loader2 size={40} className="animate-spin text-primary" />
                        </div>
                    )}
                </div>
            </div>

            {/* Profile Modal */}
            <UserProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                userId={selectedUserId || ''}
                userProfile={userProfile}
                isLoading={isProfileLoading}
                onSendMessage={() => {
                    if (selectedUserId) {
                        void handleOpenChat(selectedUserId);
                        setIsProfileModalOpen(false);
                    }
                }}
            />
        </div>
    );
};
