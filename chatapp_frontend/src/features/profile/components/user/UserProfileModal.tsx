import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Crown, Flag, Loader2, MessageCircle, Shield, ShieldOff, User, X } from "lucide-react";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { usePresence } from "@/features/presence/model/presence.store";
import { useTrackPresence } from "@/features/presence/hooks/useTrackPresence";
import { StatusDot } from "@/features/presence/ui/StatusSelector";
import { useFriendStore } from "@/features/relationships/model/friend.store";
import { Avatar, AvatarFallback, AvatarImage, DefaultUserAvatar } from "@/shared/ui/Avatar";
import { friendApi } from "@/features/relationships/api/friends.api";
import type { UserProfileModal as UserProfile } from "@/shared/types/room.types";
import type { UserDTO } from "@/entities/user/model/user.types";
import { format } from "date-fns";
import { notifyError, notifySuccess } from "@/shared/lib/notification";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";
import { ReportUserModal } from "./ReportUserModal";
import { localizeText } from '@/shared/i18n';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { logger } from '@/shared/lib/logger';
import { cn } from '@/shared/lib/cn';
import { ModalShell } from '@/shared/ui/ModalShell';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  /** Undefined hides presence when the current relationship has no visibility scope. */
  presenceConversationId?: string | null;
  onSendMessage: () => void;
  onBlock?: () => void;
  onUnblock?: () => void;
  onReport?: () => void;
  userProfile?: UserProfile;
  isLoading?: boolean;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userId,
  presenceConversationId = null,
  onSendMessage,
  onBlock,
  onUnblock,
  onReport,
  userProfile,
  isLoading = false,
}) => {
  const { user: currentUser } = useAuthStore();
  const { presence } = usePresence(userId);
  const canViewPresence = presenceConversationId !== undefined;
  useTrackPresence(canViewPresence && isOpen ? [userId] : [], presenceConversationId ?? null);
  const { blockFriend, unblockFriend, mutualFriends, fetchMutualFriends, loadingMutual } = useFriendStore();

  const [blockStatus, setBlockStatus] = useState<{ hasBlocked: boolean; isBlockedBy: boolean } | null>(null);
  const [loadingRelationship, setLoadingRelationship] = useState(false);
  const [relationshipError, setRelationshipError] = useState<string | null>(null);
  const [relationshipRetryToken, setRelationshipRetryToken] = useState(0);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isBlockConfirmOpen, setIsBlockConfirmOpen] = useState(false);
  const [isBlockLoading, setIsBlockLoading] = useState(false);
  const relationshipRequestRef = useRef(0);

  const isCurrentUser = currentUser?.userId === userId;
  const mutualForProfile = mutualFriends?.userId === userId ? mutualFriends : null;

  useEffect(() => {
    const requestId = ++relationshipRequestRef.current;
    if (!isOpen || !userId || isCurrentUser) {
      setLoadingRelationship(false);
      setRelationshipError(null);
      setBlockStatus(null);
      return;
    }

    setLoadingRelationship(true);
    setRelationshipError(null);
    setBlockStatus(null);

    const fetchRelationship = async () => {
      try {
        const relationship = await friendApi.checkBlockStatus(userId);
        if (requestId === relationshipRequestRef.current) {
          setBlockStatus(relationship);
        }
        if (requestId === relationshipRequestRef.current && currentUser?.userId) {
          await fetchMutualFriends(userId);
        }
      } catch (error) {
        if (requestId !== relationshipRequestRef.current) return;
        const message = getUserFacingErrorMessage(error, localizeText("Không thể tải dữ liệu hồ sơ liên quan."));
        setRelationshipError(message);
        logger.error('[UserProfileModal] Failed to fetch relationship', error instanceof Error ? error.message : String(error));
        notifyError(message);
      } finally {
        if (requestId === relationshipRequestRef.current) setLoadingRelationship(false);
      }
    };

    void fetchRelationship();
  }, [currentUser?.userId, fetchMutualFriends, isCurrentUser, isOpen, relationshipRetryToken, userId]);

  useEffect(() => {
    if (!isOpen) setIsReportOpen(false);
  }, [isOpen]);

  const handleBlock = useCallback(async () => {
    try {
      if (!currentUser?.userId) return;
      setIsBlockLoading(true);
      await blockFriend(userId);
      setBlockStatus({ hasBlocked: true, isBlockedBy: blockStatus?.isBlockedBy ?? false });
      setIsBlockConfirmOpen(false);
      notifySuccess(localizeText("Đã chặn người dùng này."));
      onBlock?.();
    } catch (error) {
      logger.error('[UserProfileModal] Failed to block', error instanceof Error ? error.message : String(error));
      notifyError(getUserFacingErrorMessage(error, localizeText("Không thể chặn người dùng.")));
    } finally {
      setIsBlockLoading(false);
    }
  }, [blockFriend, blockStatus?.isBlockedBy, currentUser?.userId, onBlock, userId]);

  const handleUnblock = useCallback(async () => {
    try {
      if (!currentUser?.userId) return;
      setIsBlockLoading(true);
      await unblockFriend(userId);
      setBlockStatus({ hasBlocked: false, isBlockedBy: blockStatus?.isBlockedBy ?? false });
      notifySuccess(localizeText("Đã bỏ chặn người dùng này."));
      onUnblock?.();
    } catch (error) {
      logger.error('[UserProfileModal] Failed to unblock', error instanceof Error ? error.message : String(error));
      notifyError(getUserFacingErrorMessage(error, localizeText("Không thể bỏ chặn người dùng.")));
    } finally {
      setIsBlockLoading(false);
    }
  }, [blockStatus?.isBlockedBy, currentUser?.userId, onUnblock, unblockFriend, userId]);

  if (!isOpen) {
    return null;
  }

  const hasBlocked = blockStatus?.hasBlocked ?? false;
  const isBlockedBy = blockStatus?.isBlockedBy ?? false;
  const mutualCount = mutualForProfile?.userDetails.length ?? userProfile?.mutualFriends;
  const joinedLabel = userProfile?.joinedAt ? format(new Date(userProfile.joinedAt), "MM/yyyy") : null;
  const presenceLabel = presence?.status === 'DND'
    ? localizeText("Không làm phiền")
    : presence?.isOnline
      ? localizeText("Đang hoạt động")
      : localizeText("Ngoại tuyến");
  const relationshipReady = !isCurrentUser && !isLoading && !loadingRelationship && !relationshipError && Boolean(blockStatus);

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      closeDisabled={isBlockLoading}
      showClose={false}
      title={userProfile?.displayName ?? localizeText('Hồ sơ người dùng')}
      description={localizeText('Xem hồ sơ, trạng thái và các hành động liên quan.')}
      className="overflow-hidden sm:max-w-[28rem]"
    >
      <motion.div
        aria-busy={isLoading || loadingRelationship}
        className="relative flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-card text-card-foreground sm:h-auto sm:max-h-[min(42rem,85vh)]"
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.zoomReveal}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="relative shrink-0 border-b border-border/70 bg-background/25">
            <div className="h-20 bg-primary/10" aria-hidden="true" />
            <button
              onClick={onClose}
              className="focus-ring absolute right-4 top-4 z-10 rounded-[var(--radius-md)] bg-background/70 p-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              type="button"
              aria-label={localizeText("Đóng hồ sơ")}
            >
              <X size={18} />
            </button>

            <div className="-mt-9 flex items-end gap-4 px-5 pb-5 sm:px-6">
              <div className="relative shrink-0">
                <Avatar className="h-20 w-20 rounded-[var(--radius-lg)] border-4 border-card bg-secondary text-primary shadow-sm sm:h-[5.5rem] sm:w-[5.5rem]">
                  {isLoading ? (
                    <div className="h-full w-full animate-pulse bg-secondary" aria-hidden="true" />
                  ) : userProfile?.avatarUrl ? (
                    <AvatarImage src={userProfile.avatarUrl} alt="" className="object-cover" />
                  ) : (
                    <AvatarFallback className="rounded-[var(--radius-md)] bg-secondary">
                      <DefaultUserAvatar alt={localizeText('Ảnh đại diện mặc định')} />
                    </AvatarFallback>
                  )}
                </Avatar>
                {!isLoading && canViewPresence && presence ? (
                  <StatusDot
                    status={presence.status}
                    isOnline={presence.isOnline}
                    size="md"
                    className="absolute -bottom-1 -right-1 border-2 border-card"
                    title={presenceLabel}
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1 pb-1">
                {isLoading ? (
                  <div className="space-y-2" aria-label={localizeText("Đang tải...")}>
                    <div className="h-5 w-40 animate-pulse rounded bg-secondary" />
                    <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
                  </div>
                ) : (
                  <>
                    <h2 id="user-profile-title" className="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">
                      {userProfile?.displayName}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="truncate text-xs font-semibold text-primary">@{userProfile?.username}</span>
                      {userProfile?.role === "admin" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          <Crown size={11} aria-hidden="true" /> {localizeText("Quản trị viên")}
                        </span>
                      ) : null}
                    </div>
                    {canViewPresence && presence ? (
                      <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <StatusDot status={presence.status} isOnline={presence.isOnline} size="sm" title={presenceLabel} />
                        {presenceLabel}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>

          <motion.div
            className="space-y-5 px-5 py-5 sm:px-6"
            initial={UI_MOTION_CONFIG.initialState}
            animate={UI_MOTION_CONFIG.animateState}
            variants={UI_MOTION_VARIANTS.panelReveal}
          >
            {isLoading ? (
              <div className="space-y-2" aria-hidden="true">
                <div className="h-3 w-full animate-pulse rounded bg-secondary" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-secondary" />
              </div>
            ) : userProfile?.bio ? (
              <p className="text-sm leading-6 text-muted-foreground">{userProfile.bio}</p>
            ) : null}

            {!isLoading && (joinedLabel || mutualCount !== undefined) ? (
              <dl className="grid grid-cols-2 gap-1.5">
                {joinedLabel ? (
                  <div className="rounded-[var(--radius-md)] bg-secondary/55 px-2.5 py-1.5">
                    <dt className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"><Calendar size={11} aria-hidden="true" /> {localizeText("Tham gia")}</dt>
                    <dd className="mt-0.5 text-xs font-semibold text-foreground">{joinedLabel}</dd>
                  </div>
                ) : null}
                {mutualCount !== undefined ? (
                  <div className="rounded-[var(--radius-md)] bg-secondary/55 px-2.5 py-1.5">
                    <dt className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"><User size={11} aria-hidden="true" /> {localizeText("Bạn chung")}</dt>
                    <dd className="mt-0.5 text-xs font-semibold text-foreground">{loadingMutual ? '—' : mutualCount}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            {!loadingMutual && !isCurrentUser && (mutualForProfile?.userDetails.length ?? 0) > 0 ? (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold text-foreground">{localizeText("Bạn chung")}</h3>
                  <span className="text-xs text-muted-foreground">{mutualForProfile?.userDetails.length}</span>
                </div>
                <div className="mt-3 flex items-center pl-1">
                  {mutualForProfile?.userDetails.slice(0, 5).map((friend: UserDTO) => (
                    <Avatar key={friend.userId} className="-ml-1.5 h-8 w-8 border-2 border-card" title={friend.displayName}>
                      <AvatarImage src={friend.avatarUrl} alt="" />
                      <AvatarFallback><DefaultUserAvatar alt={localizeText('Ảnh đại diện mặc định')} /></AvatarFallback>
                    </Avatar>
                  ))}
                  {(mutualForProfile?.userDetails.length ?? 0) > 5 ? (
                    <span className="-ml-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-bold text-muted-foreground">
                      +{(mutualForProfile?.userDetails.length ?? 0) - 5}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {hasBlocked ? (
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-destructive/10 px-3 py-2.5 text-xs font-semibold text-destructive" role="status">
                <Shield size={14} aria-hidden="true" /> {localizeText("Bạn đã chặn người dùng này")}
              </div>
            ) : null}
            {isBlockedBy && !hasBlocked ? (
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-muted px-3 py-2.5 text-xs font-semibold text-muted-foreground" role="status">
                <Shield size={14} aria-hidden="true" /> {localizeText("Người dùng này đã chặn bạn")}
              </div>
            ) : null}

            {isCurrentUser ? (
              <p className="text-sm text-muted-foreground">{localizeText("Đây là hồ sơ của bạn")}</p>
            ) : null}
            {loadingRelationship ? (
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground" role="status" aria-live="polite">
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                {localizeText("Đang tải dữ liệu mối quan hệ...")}
              </div>
            ) : null}
            {relationshipError && !loadingRelationship ? (
              <div role="alert" className="flex flex-col gap-3 rounded-[var(--radius-md)] bg-destructive/10 px-3 py-3 text-xs font-semibold text-destructive">
                <span>{relationshipError}</span>
                <button type="button" className="self-start rounded-[var(--radius-sm)] border border-destructive/30 px-3 py-2 text-xs font-semibold transition-colors hover:bg-destructive/10" onClick={() => setRelationshipRetryToken((value) => value + 1)}>
                  {localizeText("Thử lại")}
                </button>
              </div>
            ) : null}
          </motion.div>

          {relationshipReady ? (
            <div className="mt-auto shrink-0 border-t border-border/70 bg-card px-5 py-4 sm:px-6">
              {!isBlockedBy && !hasBlocked ? (
                <button
                  onClick={onSendMessage}
                  type="button"
                  className="focus-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.99]"
                >
                  <MessageCircle size={17} aria-hidden="true" />
                  {localizeText("Nhắn tin")}
                </button>
              ) : null}

              <div className="mt-2 grid grid-cols-2 gap-2">
                {hasBlocked ? (
                  <button onClick={handleUnblock} type="button" disabled={isBlockLoading} className="focus-ring col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-primary/40 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50">
                    <ShieldOff size={15} aria-hidden="true" /> {isBlockLoading ? localizeText("Đang cập nhật...") : localizeText("Bỏ chặn người dùng này")}
                  </button>
                ) : !isBlockedBy ? (
                  <button onClick={() => setIsBlockConfirmOpen(true)} type="button" className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive">
                    <Shield size={15} aria-hidden="true" /> {localizeText("Chặn người dùng này")}
                  </button>
                ) : null}
                <button onClick={() => setIsReportOpen(true)} type="button" className={cn("focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground", isBlockedBy ? "col-span-2" : "")}>
                  <Flag size={15} aria-hidden="true" /> {localizeText("Báo cáo hồ sơ")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>

      {isReportOpen && userProfile ? (
        <ReportUserModal
          userId={userId}
          displayName={userProfile.displayName}
          onClose={() => setIsReportOpen(false)}
          onSubmitted={() => {
            setIsReportOpen(false);
            notifySuccess(localizeText("Đã gửi báo cáo hồ sơ. Cảm ơn bạn đã giúp giữ Nối an toàn."));
            onReport?.();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={isBlockConfirmOpen}
        onOpenChange={setIsBlockConfirmOpen}
        title={localizeText("Chặn người dùng")}
        description={localizeText("Bạn có chắc chắn muốn chặn người dùng này?")}
        confirmLabel={localizeText("Chặn")}
        destructive
        loading={isBlockLoading}
        onConfirm={handleBlock}
      />
    </ModalShell>
  );
};
