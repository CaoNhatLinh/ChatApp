import React from 'react';
import { X, Ban, Palette, ShieldOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMessenger } from '@/features/messenger/model/useMessenger';
import type { Conversation } from '@/features/messenger/types/messenger.types';
import { useFriendStore } from '@/features/relationships/model/friend.store';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { friendApi } from '@/features/relationships/api/friends.api';
import { Avatar, AvatarFallback, AvatarImage, DefaultUserAvatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import { InviteManager } from './InviteManager';
import { RoomManagementPanel } from './RoomManagementPanel';
import {
    getConversationNotificationPolicy,
    updateConversationNotificationPolicy as saveConversationNotificationPolicy,
    updateMemberNotificationPolicy as saveMemberNotificationPolicy,
    type ConversationNotificationPolicyView,
} from '@/features/messenger/api/messenger.api';
import type {
    ConversationNotificationLevel,
    MemberNotificationOverride,
} from '@/features/messenger/types/messenger.types';
import { useMessengerStore } from '@/features/messenger/model/messenger.store';
import { notifyError, notifySuccess } from '@/shared/lib/notification';
import { localizeText } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { logger } from '@/shared/lib/logger';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

const ROOM_NOTIFICATION_LEVELS: Array<{ value: ConversationNotificationLevel; label: string; hint: string }> = [
    { value: 'ALL', label: 'Tất cả hoạt động', hint: 'Nhận mọi thông báo được phép.' },
    { value: 'MENTIONS', label: 'Chỉ lượt nhắc', hint: 'Chỉ nhận thông báo khi có người nhắc bạn.' },
    { value: 'NONE', label: 'Tắt toàn bộ', hint: 'Không nhận thông báo ngoài các cảnh báo an toàn bắt buộc.' },
];

const MEMBER_NOTIFICATION_LEVELS: Array<{ value: MemberNotificationOverride; label: string; hint: string }> = [
    { value: 'INHERIT', label: 'Theo mặc định phòng', hint: 'Dùng mức thông báo do phòng đặt.' },
    ...ROOM_NOTIFICATION_LEVELS,
];

const roomNotificationRank: Record<ConversationNotificationLevel, number> = {
    ALL: 0,
    MENTIONS: 1,
    NONE: 2,
};

interface ConversationInfoProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenAppearance: () => void;
}

export const ConversationInfo: React.FC<ConversationInfoProps> = ({ isOpen, onClose, onOpenAppearance }) => {
    const { conversations, activeConversationId } = useMessenger();
    const updateConversationNotificationPolicy = useMessengerStore(
        (state) => state.updateConversationNotificationPolicy,
    );

    // UI states for new features
    const [blockStatus, setBlockStatus] = React.useState<{ hasBlocked: boolean; isBlockedBy: boolean } | null>(null);
    const [blockStatusLoading, setBlockStatusLoading] = React.useState(false);
    const [blockStatusError, setBlockStatusError] = React.useState(false);
    const [blockStatusRetry, setBlockStatusRetry] = React.useState(0);
    const [isBlockConfirmOpen, setIsBlockConfirmOpen] = React.useState(false);
    const [isBlockLoading, setIsBlockLoading] = React.useState(false);
    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const [notificationPolicy, setNotificationPolicy] = React.useState<ConversationNotificationPolicyView | null>(null);
    const [notificationPolicyLoading, setNotificationPolicyLoading] = React.useState(false);
    const [notificationPolicySaving, setNotificationPolicySaving] = React.useState(false);
    const [notificationPolicyError, setNotificationPolicyError] = React.useState(false);
    const [roomNotificationLevel, setRoomNotificationLevel] = React.useState<ConversationNotificationLevel>('ALL');
    const [memberNotificationOverride, setMemberNotificationOverride] = React.useState<MemberNotificationOverride>('INHERIT');
    const notificationPolicyRequestRef = React.useRef(0);
    const notificationPolicyMutationRef = React.useRef(0);

    const { user: currentUser } = useAuthStore();
    const { blockFriend, unblockFriend, fetchBlockedUsers } = useFriendStore();

    const activeConv = conversations?.find((c: Conversation) => c.conversationId === activeConversationId);

    const loadNotificationPolicy = React.useCallback(async () => {
        const requestId = ++notificationPolicyRequestRef.current;
        if (!activeConversationId) {
            setNotificationPolicy(null);
            setNotificationPolicyLoading(false);
            setNotificationPolicyError(false);
            return;
        }
        setNotificationPolicyLoading(true);
        setNotificationPolicyError(false);
        try {
            const nextPolicy = await getConversationNotificationPolicy(activeConversationId);
            if (requestId !== notificationPolicyRequestRef.current) return;
            setNotificationPolicy(nextPolicy);
            setRoomNotificationLevel(nextPolicy.defaultNotificationLevel);
            setMemberNotificationOverride(nextPolicy.notificationOverride);
        } catch (error) {
            if (requestId !== notificationPolicyRequestRef.current) return;
            setNotificationPolicy(null);
            setNotificationPolicyError(true);
            logger.error('[ConversationInfo] Notification policy load failed', error instanceof Error ? error.message : String(error));
        } finally {
            if (requestId === notificationPolicyRequestRef.current) setNotificationPolicyLoading(false);
        }
    }, [activeConversationId]);

    React.useEffect(() => {
        if (isOpen && showAdvanced && activeConversationId) {
            void loadNotificationPolicy();
        } else {
            notificationPolicyRequestRef.current += 1;
            setNotificationPolicy(null);
            setNotificationPolicyLoading(false);
            setNotificationPolicyError(false);
        }
    }, [activeConversationId, isOpen, loadNotificationPolicy, showAdvanced]);

    const canManageRoomNotifications = Boolean(currentUser?.userId && activeConv?.ownerId === currentUser.userId);

    const saveNotificationPolicy = async () => {
        if (!activeConv || !currentUser?.userId || !notificationPolicy) return;
        const mutationId = ++notificationPolicyMutationRef.current;
        const conversationId = activeConv.conversationId;
        const isCurrentMutation = () => (
            mutationId === notificationPolicyMutationRef.current && isOpen && activeConversationId === conversationId
        );
        setNotificationPolicySaving(true);
        try {
            if (!isCurrentMutation()) return;
            if (canManageRoomNotifications && roomNotificationLevel !== notificationPolicy.defaultNotificationLevel) {
                await saveConversationNotificationPolicy(conversationId, {
                    defaultNotificationLevel: roomNotificationLevel,
                });
            }
            if (!isCurrentMutation()) return;
            if (memberNotificationOverride !== notificationPolicy.notificationOverride) {
                await saveMemberNotificationPolicy(conversationId, currentUser.userId, {
                    notificationOverride: memberNotificationOverride,
                });
            }
            if (!isCurrentMutation()) return;
            const nextPolicy = {
                defaultNotificationLevel: roomNotificationLevel,
                notificationOverride: memberNotificationOverride,
            } satisfies ConversationNotificationPolicyView;
            setNotificationPolicy(nextPolicy);
            updateConversationNotificationPolicy(conversationId, nextPolicy);
            notifySuccess(localizeText('Đã cập nhật cài đặt thông báo của phòng.'));
        } catch (error: unknown) {
            if (!isCurrentMutation()) return;
            logger.error('[ConversationInfo] Notification policy save failed', error instanceof Error ? error.message : String(error));
            notifyError(getUserFacingErrorMessage(error, localizeText('Không thể cập nhật cài đặt thông báo của phòng.')));
            setRoomNotificationLevel(notificationPolicy.defaultNotificationLevel);
            setMemberNotificationOverride(notificationPolicy.notificationOverride);
        } finally {
            if (mutationId === notificationPolicyMutationRef.current) setNotificationPolicySaving(false);
        }
    };

    // Fetch block status for DM conversations
    React.useEffect(() => {
        const otherUserId = activeConv?.type === 'dm' ? activeConv.otherParticipant?.userId : undefined;
        if (!isOpen || !showAdvanced || !otherUserId) {
            setBlockStatus(null);
            setBlockStatusLoading(false);
            setBlockStatusError(false);
            return undefined;
        }

        let active = true;
        setBlockStatus(null);
        setBlockStatusLoading(true);
        setBlockStatusError(false);
        void friendApi.checkBlockStatus(otherUserId)
            .then((status) => {
                if (active) setBlockStatus(status);
            })
            .catch((error: unknown) => {
                if (!active) return;
                setBlockStatusError(true);
                logger.error('[ConversationInfo] Block check failed', error instanceof Error ? error.message : String(error));
                notifyError(getUserFacingErrorMessage(error, localizeText('Không thể kiểm tra trạng thái chặn.')));
            })
            .finally(() => {
                if (active) setBlockStatusLoading(false);
            });

        return () => {
            active = false;
        };
    }, [activeConv?.conversationId, activeConv?.otherParticipant?.userId, activeConv?.type, blockStatusRetry, isOpen, showAdvanced]);

    const handleBlock = async () => {
        if (!currentUser?.userId || !activeConv?.otherParticipant?.userId) return;
        setIsBlockLoading(true);
        try {
            await blockFriend(activeConv.otherParticipant.userId);
            setBlockStatus({ hasBlocked: true, isBlockedBy: blockStatus?.isBlockedBy ?? false });
            setIsBlockConfirmOpen(false);
            void fetchBlockedUsers();
            notifySuccess(localizeText('Đã chặn người dùng.'));
        } catch (error: unknown) {
            logger.error('[ConversationInfo] Block action failed', error instanceof Error ? error.message : String(error));
            notifyError(getUserFacingErrorMessage(error, localizeText('Không thể chặn người dùng.')));
        } finally {
            setIsBlockLoading(false);
        }
    };

    const handleUnblock = async () => {
        if (!currentUser?.userId || !activeConv?.otherParticipant?.userId) return;
        setIsBlockLoading(true);
        try {
            await unblockFriend(activeConv.otherParticipant.userId);
            setBlockStatus({ hasBlocked: false, isBlockedBy: blockStatus?.isBlockedBy ?? false });
            void fetchBlockedUsers();
            notifySuccess(localizeText('Đã bỏ chặn người dùng.'));
        } catch (error) {
            logger.error('[ConversationInfo] Unblock action failed', error instanceof Error ? error.message : String(error));
            notifyError(getUserFacingErrorMessage(error, localizeText('Không thể bỏ chặn người dùng.')));
        } finally {
            setIsBlockLoading(false);
        }
    };

    if (!isOpen || !activeConv) return null;

    return (
        <motion.div
            className="flex h-full w-[100dvw] max-w-full shrink-0 flex-col bg-[#0d1720] sm:w-[320px] sm:border-l sm:border-white/10 md:w-[286px]"
            initial={UI_MOTION_CONFIG.initialState}
            animate={UI_MOTION_CONFIG.animateState}
            variants={UI_MOTION_VARIANTS.slideInFromRight}
        >
            {/* Header */}
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
                <h3 className="text-sm font-semibold">{MESSENGER_COPY.conversationInfo.title}</h3>
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
            <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-5">
                {/* Profile Overview */}
                <div className="flex flex-col items-center space-y-3 text-center">
                    <div className="relative">
                        <Avatar className="h-20 w-20 border border-white/10">
                            <AvatarImage src={activeConv.otherParticipant?.avatarUrl} />
                            <AvatarFallback className="bg-primary/10">
                                <DefaultUserAvatar alt={localizeText('Ảnh đại diện mặc định')} />
                            </AvatarFallback>
                        </Avatar>
                    </div>

                    <div className="w-full px-2">
                        <div className="flex items-center justify-center gap-2 p-1">
                            <h2 className="break-all text-base font-semibold tracking-tight">{activeConv.name}</h2>
                        </div>
                        {activeConv.type === 'dm' && activeConv.otherParticipant && (
                            <p className="text-xs font-bold text-primary uppercase tracking-widest mt-1">@{activeConv.otherParticipant.userName}</p>
                        )}
                    </div>
                </div>

                <div className="border-y border-white/10 py-2">
                    <div className="flex items-center justify-between py-2 text-sm">
                        <span className="text-muted-foreground">{activeConv.type === 'dm' ? localizeText('Cuộc trò chuyện riêng') : localizeText('Thành viên')}</span>
                        <span>{activeConv.type === 'dm' ? '1' : activeConv.memberCount}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 text-sm">
                        <span className="text-muted-foreground">{localizeText('Tệp và nội dung dùng chung')}</span>
                        <span className="text-muted-foreground">—</span>
                    </div>
                </div>

                <Button type="button" variant="outline" className="w-full border-white/10 bg-white/5 text-slate-100 hover:bg-white/10" onClick={() => setShowAdvanced((current) => !current)}>
                    {showAdvanced ? localizeText('Thu gọn tùy chọn') : localizeText('Tùy chọn cuộc trò chuyện')}
                </Button>

                {showAdvanced ? <div className="space-y-6">
                    <section className="space-y-2" aria-labelledby="conversation-appearance-title">
                        <div>
                            <h4 id="conversation-appearance-title" className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest mb-1 px-1">
                                {localizeText('Giao diện')}
                            </h4>
                            <p className="px-1 text-xs leading-5 text-muted-foreground">
                                {localizeText('Tùy chỉnh này chỉ hiển thị với bạn.')}
                            </p>
                        </div>
                        <Button type="button" variant="outline" className="w-full border-white/10 bg-white/5 text-slate-100 hover:bg-white/10" onClick={onOpenAppearance}>
                            <Palette className="h-4 w-4" /> {localizeText('Tùy chỉnh giao diện cá nhân')}
                        </Button>
                    </section>

                    <section className="space-y-4" aria-labelledby="conversation-notification-title">
                        <div>
                            <h4 id="conversation-notification-title" className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest mb-1 px-1">
                                {localizeText('Thông báo phòng')}
                            </h4>
                            <p className="px-1 text-xs leading-5 text-muted-foreground">
                                {localizeText('Chọn mức thông báo mặc định của phòng và thiết lập riêng cho bạn.')}
                            </p>
                        </div>
                        {notificationPolicyLoading ? (
                            <p className="text-sm text-muted-foreground">{localizeText('Đang tải cài đặt thông báo...')}</p>
                        ) : notificationPolicyError ? (
                            <div className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                                <p className="text-destructive">{localizeText('Không thể tải cài đặt thông báo của phòng.')}</p>
                                <Button type="button" variant="outline" size="sm" onClick={() => void loadNotificationPolicy()}>
                                    {localizeText('Thử lại')}
                                </Button>
                            </div>
                        ) : notificationPolicy ? (
                            <div className="space-y-4">
                                <label className="block space-y-2">
                                    <span className="text-sm font-semibold">{localizeText('Mặc định của phòng')}</span>
                                    <select
                                        className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                                        value={roomNotificationLevel}
                                        disabled={!canManageRoomNotifications || notificationPolicySaving}
                                        onChange={(event) => setRoomNotificationLevel(event.target.value as ConversationNotificationLevel)}
                                    >
                                        {ROOM_NOTIFICATION_LEVELS.map((option) => (
                                            <option
                                                key={option.value}
                                                value={option.value}
                                                disabled={roomNotificationRank[option.value] < roomNotificationRank[notificationPolicy.defaultNotificationLevel]}
                                            >
                                                {localizeText(option.label)}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="block text-xs leading-5 text-muted-foreground">
                                        {canManageRoomNotifications
                                            ? localizeText('Chủ phòng có thể thay đổi mức mặc định cho tất cả thành viên.')
                                            : localizeText('Chỉ chủ phòng có thể thay đổi mức mặc định.')}
                                    </span>
                                </label>
                                <label className="block space-y-2">
                                    <span className="text-sm font-semibold">{localizeText('Cài đặt của bạn')}</span>
                                    <select
                                        className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                                        value={memberNotificationOverride}
                                        disabled={notificationPolicySaving}
                                        onChange={(event) => setMemberNotificationOverride(event.target.value as MemberNotificationOverride)}
                                    >
                                        {MEMBER_NOTIFICATION_LEVELS.map((option) => (
                                            <option key={option.value} value={option.value}>{localizeText(option.label)}</option>
                                        ))}
                                    </select>
                                </label>
                                <Button type="button" className="w-full" loading={notificationPolicySaving} onClick={() => void saveNotificationPolicy()}>
                                    {localizeText('Lưu cài đặt thông báo')}
                                </Button>
                            </div>
                        ) : null}
                    </section>

                    {activeConv.type !== 'dm' && (
                        <>
                            <RoomManagementPanel conversation={activeConv} />
                            <InviteManager conversationId={activeConv.conversationId} />
                        </>
                    )}
                    {/* Danger Zone */}
                    <div>
                        <h4 className="text-[10px] font-black uppercase text-destructive tracking-widest mb-3 px-1">
                            {MESSENGER_COPY.conversationInfo.dangerZone}
                        </h4>
                        <div className="space-y-1">
                            {activeConv.type === 'dm' && activeConv.otherParticipant && (
                                blockStatusLoading ? (
                                    <p className="px-3 py-2 text-sm text-muted-foreground">{localizeText('Đang kiểm tra trạng thái chặn...')}</p>
                                ) : blockStatusError ? (
                                    <div className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                                        <p className="text-destructive">{localizeText('Không thể kiểm tra trạng thái chặn.')}</p>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setBlockStatusRetry((value) => value + 1)}>
                                            {localizeText('Thử lại')}
                                        </Button>
                                    </div>
                                ) : blockStatus?.hasBlocked ? (
                                    <button
                                        type="button"
                                        disabled={isBlockLoading}
                                        onClick={() => void handleUnblock()}
                                        className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-primary/10 text-primary transition-[color,background-color,border-color,box-shadow,transform,opacity] group"
                                    >
                                        <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                            <ShieldOff size={18} />
                                        </div>
                                        <span className="font-bold text-sm">{MESSENGER_COPY.conversationInfo.unblockUser}</span>
                                    </button>
                                ) : blockStatus ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsBlockConfirmOpen(true)}
                                        className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-destructive/10 text-destructive transition-[color,background-color,border-color,box-shadow,transform,opacity] group"
                                    >
                                        <div className="p-2 bg-destructive/10 rounded-xl group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                                            <Ban size={18} />
                                        </div>
                                        <span className="font-bold text-sm">{MESSENGER_COPY.conversationInfo.blockUser}</span>
                                    </button>
                                ) : null
                            )}

                        </div>
                    </div>
                </div> : null}
            </div>
            <ConfirmDialog
                open={isBlockConfirmOpen}
                onOpenChange={setIsBlockConfirmOpen}
                title={localizeText('Chặn người dùng')}
                description={MESSENGER_COPY.conversationInfo.confirmBlock}
                confirmLabel={localizeText('Chặn')}
                destructive
                loading={isBlockLoading}
                onConfirm={handleBlock}
            />
        </motion.div>
    );
};

