import React, { useMemo, useState } from 'react';
import { Search, Settings, MessageSquare, Users, Loader2 } from 'lucide-react';
import { useMessenger } from '@/features/messenger/model/useMessenger';
import { ConversationItem } from './ConversationItem';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { UserSettingsModal } from '@/features/settings/ui/UserSettingsModal';
import { CreateRoomModal } from '@/features/messenger/components/Modals/CreateRoomModal';
import { useTrackPresence } from '@/features/presence/hooks/useTrackPresence';
import { usePresenceStore } from '@/features/presence/model/presence.store';
import { StatusSelector, StatusDot } from '@/features/presence/ui/StatusSelector';
import type { Conversation } from '@/features/messenger/types/messenger.types';
import NotificationList, { NotificationButton } from '@/features/notifications/components/notification/NotificationList';
import {
    getAllNotifications,
    getNotificationConversationId,
    getUnreadCount,
    markAllAsRead,
    markNotificationAsRead,
    type NotificationRecord,
} from '@/features/notifications/api/notifications.api';
import { realtimeService } from '@/shared/websocket/realtime-service';

export const ChatSidebar: React.FC = () => {
    const {
        conversations,
        selectConversation,
        activeConversationId,
        setActiveView,
        activeView,
        loadMoreConversations,
        conversationsHasNext,
        loading,
        pinConversation,
        unpinConversation,
        friendRequestCount,
    } = useMessenger();

    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
    const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [settingsModalTab, setSettingsModalTab] = useState<'profile' | 'appearance'>('profile');

    const { user } = useAuthStore();
    const myStatus = usePresenceStore(state => state.myStatus);
    const isUserOnline = myStatus === 'ONLINE' || myStatus === 'DND';
    const sentinelRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!conversationsHasNext || loading || searchTerm) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                void loadMoreConversations();
            }
        }, { threshold: 0.1 });

        const sentinel = sentinelRef.current;
        if (sentinel) {
            observer.observe(sentinel);
        }

        return () => {
            if (sentinel) {
                observer.unobserve(sentinel);
            }
        };
    }, [conversationsHasNext, loading, loadMoreConversations, searchTerm]);

    React.useEffect(() => {
        if (!user?.userId) {
            return;
        }

        let cancelled = false;

        const initializeNotifications = async () => {
            try {
                const [page, unreadCount] = await Promise.all([
                    getAllNotifications(0, 50),
                    getUnreadCount(),
                ]);

                if (cancelled) {
                    return;
                }

                setNotifications(page.content);
                setNotificationUnreadCount(unreadCount);
            } catch (error) {
                console.error('Failed to initialize notifications:', error);
            }
        };

        void initializeNotifications();

        const unsubscribeNotification = realtimeService.subscribe(`/user/${user.userId}/queue/notifications`, (payload: NotificationRecord) => {
            setNotifications(current => {
                const existingIndex = current.findIndex(notification => notification.notificationId === payload.notificationId);
                if (existingIndex === -1) {
                    return [payload, ...current];
                }

                const next = [...current];
                next[existingIndex] = payload;
                return next;
            });

            if (!payload.isRead) {
                setNotificationUnreadCount(current => current + 1);
            }
        });

        const unsubscribeRead = realtimeService.subscribe(`/user/${user.userId}/queue/notification-read`, (payload: { notificationId?: string; notificationIds?: string[]; action?: string }) => {
            if (payload.action === 'MARK_ALL_READ') {
                setNotifications(current => current.map(notification => ({ ...notification, isRead: true })));
                setNotificationUnreadCount(0);
                return;
            }

            const readIds = new Set<string>([
                ...(typeof payload.notificationId === 'string' ? [payload.notificationId] : []),
                ...((payload.notificationIds ?? []).filter((id): id is string => typeof id === 'string')),
            ]);

            if (readIds.size === 0) {
                return;
            }

            setNotifications(current => current.map(notification => (
                readIds.has(notification.notificationId)
                    ? { ...notification, isRead: true }
                    : notification
            )));
            setNotificationUnreadCount(current => Math.max(0, current - readIds.size));
        });

        const unsubscribeDelete = realtimeService.subscribe(`/user/${user.userId}/queue/notification-delete`, (payload: { notificationId?: string; action?: string }) => {
            if (payload.action === 'DELETE_ALL') {
                setNotifications([]);
                setNotificationUnreadCount(0);
                return;
            }

            if (!payload.notificationId) {
                return;
            }

            setNotifications(current => {
                const target = current.find(notification => notification.notificationId === payload.notificationId);
                if (target && !target.isRead) {
                    setNotificationUnreadCount(count => Math.max(0, count - 1));
                }
                return current.filter(notification => notification.notificationId !== payload.notificationId);
            });
        });

        return () => {
            cancelled = true;
            unsubscribeNotification();
            unsubscribeRead();
            unsubscribeDelete();
        };
    }, [user?.userId]);

    const handleOpenSettings = (tab: 'profile' | 'appearance' = 'profile') => {
        setSettingsModalTab(tab);
        setIsSettingsModalOpen(true);
    };

    const filteredConversations = (conversations || []).filter((c: Conversation) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const dmUserIds = useMemo(() =>
        filteredConversations
            .filter((c: Conversation) => c.type === 'dm' && c.otherParticipant)
            .map((c: Conversation) => c.otherParticipant?.userId)
            .filter((id: string | undefined): id is string => Boolean(id)),
        [filteredConversations]
    );
    useTrackPresence(dmUserIds);

    const conversationNotificationCounts = useMemo(() => {
        return notifications.reduce<Record<string, number>>((accumulator: Record<string, number>, notification: NotificationRecord) => {
            if (notification.isRead) {
                return accumulator;
            }

            const conversationId = getNotificationConversationId(notification);
            if (!conversationId) {
                return accumulator;
            }

            accumulator[conversationId] = (accumulator[conversationId] ?? 0) + 1;
            return accumulator;
        }, {});
    }, [notifications]);

    const handleNotificationClick = React.useCallback(async (notification: NotificationRecord) => {
        if (!notification.isRead) {
            await markNotificationAsRead(notification.notificationId);
            setNotifications(current => current.map(item => (
                item.notificationId === notification.notificationId
                    ? { ...item, isRead: true }
                    : item
            )));
            setNotificationUnreadCount(current => Math.max(0, current - 1));
        }

        const conversationId = getNotificationConversationId(notification);
        setIsPanelOpen(false);

        if (conversationId) {
            await selectConversation(conversationId);
            return;
        }

        if (notification.type === 'FRIEND_REQUEST') {
            setActiveView('contacts');
        }
    }, [selectConversation, setActiveView]);

    const handleMarkAllNotificationsAsRead = React.useCallback(async () => {
        await markAllAsRead();
        setNotifications(current => current.map(notification => ({ ...notification, isRead: true })));
        setNotificationUnreadCount(0);
    }, []);

    return (
        <div className="w-[350px] h-full glass border-r border-border/50 flex flex-col z-20 relative">
            <div className="p-6 space-y-6 flex-shrink-0">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-black tracking-tighter text-gradient">CHATS</h2>
                    <div className="flex gap-2">
                        <div className="relative">
                            <NotificationButton
                                unreadCount={notificationUnreadCount}
                                isOpen={isPanelOpen}
                                onClick={() => setIsPanelOpen(!isPanelOpen)}
                            />
                            <NotificationList
                                isOpen={isPanelOpen}
                                onClose={() => setIsPanelOpen(false)}
                                notifications={notifications}
                                onMarkAsRead={markNotificationAsRead}
                                onMarkAllAsRead={handleMarkAllNotificationsAsRead}
                                onNotificationClick={handleNotificationClick}
                            />
                        </div>
                        <button
                            onClick={() => setActiveView('contacts')}
                            className={`p-2 rounded-xl transition-all relative ${activeView === 'contacts' ? 'bg-primary text-primary-foreground neo-shadow' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'}`}
                            title="Danh bạ & Bạn bè"
                        >
                            <Users size={20} />
                            {(friendRequestCount ?? 0) > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-black rounded-full flex items-center justify-center neo-shadow border-2 border-background animate-in zoom-in duration-300">
                                    {(friendRequestCount ?? 0) > 99 ? '99+' : friendRequestCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setIsCreateRoomModalOpen(true)}
                            className="p-2 hover:bg-primary/10 rounded-xl text-muted-foreground hover:text-primary transition-all"
                            title="Tạo nhóm mới (Room)"
                        >
                            <Users size={20} />
                        </button>
                    </div>
                </div>

                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        placeholder="Tìm kiếm hội thoại..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-background/50 border-2 border-border/30 rounded-2xl py-3 pl-12 pr-4 focus:ring-0 focus:border-primary focus:bg-background transition-all placeholder:text-muted-foreground/40 outline-none text-sm font-medium"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1 pb-4">
                {filteredConversations.length > 0 ? (
                    <>
                        {filteredConversations.map((conv: Conversation) => (
                            <ConversationItem
                                key={conv.conversationId}
                                conversation={conv}
                                isActive={activeConversationId === conv.conversationId}
                                notificationCount={conversationNotificationCounts[conv.conversationId] ?? 0}
                                onClick={() => void selectConversation(conv.conversationId)}
                                onPin={pinConversation}
                                onUnpin={unpinConversation}
                            />
                        ))}
                        <div ref={sentinelRef} className="h-4 w-full" />
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-40 opacity-40">
                        <MessageSquare size={48} className="mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest text-center">
                            {searchTerm ? 'Không tìm thấy kết quả' : 'Chưa có cuộc hội thoại nào'}
                        </p>
                    </div>
                )}

                {loading && (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 size={24} className="animate-spin text-primary/50" />
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-border/50 relative">
                <StatusSelector>
                    <div className="relative flex items-center gap-3 p-2 rounded-2xl transition-colors group cursor-pointer hover:bg-muted/50">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center overflow-hidden border-2 border-primary/30 transition-all">
                                {user?.avatarUrl ? (
                                    <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-primary font-black uppercase text-lg">{user?.displayName?.charAt(0)}</span>
                                )}
                            </div>
                            <StatusDot
                                status={myStatus}
                                isOnline={isUserOnline}
                                size="md"
                                className="absolute bottom-[-2px] right-[-2px] border-2 border-background shadow-sm transition-colors"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-black truncate">{user?.displayName}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">@ {user?.userName}</p>
                        </div>
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSettings('profile');
                            }}
                            className="transition-all p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-background hover:text-primary z-10"
                            title="Cài đặt"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </StatusSelector>
            </div>

            <UserSettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                initialTab={settingsModalTab}
            />

            <CreateRoomModal
                isOpen={isCreateRoomModalOpen}
                onClose={() => setIsCreateRoomModalOpen(false)}
            />
        </div>
    );
};
