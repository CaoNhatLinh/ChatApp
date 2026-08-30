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
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { logger } from '@/shared/lib/logger';

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
  const dialogRef = useRef<HTMLDivElement>(null);
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

  useFocusTrap(isOpen && !isReportOpen && !isBlockConfirmOpen, dialogRef, onClose);

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

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
      <motion.div
        className="absolute inset-0 bg-background/40 backdrop-blur-md"
        onClick={onClose}
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.fadeIn}
      />

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-profile-title"
        className="relative flex w-full max-w-[95vw] flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0e141b] text-slate-100 shadow-[0_24px_80px_rgba(3,7,18,0.38)] sm:max-w-md sm:rounded-[2rem]"
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.zoomReveal}
      >
        <div className="relative h-28 bg-[radial-gradient(circle_at_18%_0%,rgba(238,105,43,0.42),transparent_38%),linear-gradient(135deg,#302031_0%,#182334_100%)] sm:h-32">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full bg-black/20 p-2 text-slate-300 transition-[color,background-color] hover:bg-white/10 hover:text-white"
            type="button"
            aria-label={localizeText("Đóng hồ sơ")}
          >
            <X size={20} />
          </button>
        </div>

        <motion.div
          className="-mt-14 flex flex-col items-center px-6 pb-7 text-center sm:-mt-16 sm:px-8"
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.panelReveal}
        >
          <motion.div className="relative mb-6" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.rowReveal}>
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[1.75rem] border-4 border-[#0e141b] bg-[#171f2a] text-4xl font-black uppercase text-primary shadow-lg sm:h-32 sm:w-32 sm:rounded-[2rem]">
              {isLoading ? (
                <Loader2 className="animate-spin" size={40} />
              ) : (
                userProfile?.avatarUrl ? (
                  <img src={userProfile.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : <img src="/noi-default-avatar.webp" alt={localizeText('Ảnh đại diện mặc định')} className="h-full w-full object-cover" />
              )}
            </div>
            {!isLoading && canViewPresence && presence ? (
              <StatusDot
                status={presence.status}
                isOnline={presence.isOnline}
                size="lg"
              className="absolute -bottom-1 right-2 border-4 border-[#0e141b]"
              />
            ) : null}
          </motion.div>

          <motion.div className="space-y-1 mb-6" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.rowReveal}>
            <h2 id="user-profile-title" className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              {isLoading ? localizeText("Đang tải...") : userProfile?.displayName}
            </h2>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-semibold text-primary">@{userProfile?.username}</span>
              {userProfile?.role === "admin" ? (
                <div className="flex items-center gap-1 bg-yellow-400/10 text-yellow-500 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                  <Crown size={10} /> {localizeText("Quản trị viên")}
                </div>
              ) : null}
            </div>
            {canViewPresence && presence ? (
              <p className="pt-2 text-[10px] font-semibold tracking-wide text-slate-400">
                {presence.isOnline ? localizeText("Đang hoạt động") : localizeText("Ngoại tuyến")}
              </p>
            ) : null}
          </motion.div>

          {hasBlocked && (
            <motion.div className="mb-3 flex items-center justify-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive rounded-xl text-xs font-bold" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.rowReveal}>
              <Shield size={12} /> {localizeText("Bạn đã chặn người dùng này")}
            </motion.div>
          )}
          {isBlockedBy && !hasBlocked && (
            <motion.div className="mb-3 flex items-center justify-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-xl text-xs font-bold" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.rowReveal}>
            {localizeText("Người dùng này đã chặn bạn")}
            </motion.div>
          )}

          <motion.div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mb-7" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.panelReveal}>
            <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/[0.07] p-3">
              <Calendar size={14} className="text-primary/60" />
              <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{localizeText("Tham gia")}</span>
              <span className="text-xs font-bold text-slate-100">
                {userProfile?.joinedAt ? format(new Date(userProfile.joinedAt), "MM/yyyy") : null}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/[0.07] p-3">
              <User size={14} className="text-primary/60" />
              <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{localizeText("Bạn chung")}</span>
              <span className="text-xs font-bold text-slate-100">{loadingMutual ? null : mutualForProfile?.userDetails.length ?? null}</span>
            </div>
          </motion.div>

          {!loadingMutual && !isCurrentUser && (mutualForProfile?.userDetails?.length ?? 0) > 0 ? (
            <motion.div className="w-full mb-8 text-left" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.panelReveal}>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1">
                {localizeText("Bạn chung")} ({mutualForProfile?.userDetails.length})
              </h3>
              <div className="flex -space-x-2 overflow-hidden px-1">
                {mutualForProfile?.userDetails.slice(0, 5).map((friend: UserDTO) => (
                <Avatar key={friend.userId} className="h-8 w-8 border-2 border-background neo-shadow-sm" title={friend.displayName}>
                    <AvatarImage src={friend.avatarUrl} />
                    <AvatarFallback className="text-[10px]"><DefaultUserAvatar alt={localizeText('Ảnh đại diện mặc định')} /></AvatarFallback>
                  </Avatar>
                ))}
                {(mutualForProfile?.userDetails.length ?? 0) > 5 && (
                  <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground neo-shadow-sm">
                    +{(mutualForProfile?.userDetails.length ?? 0) - 5}
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}

          {!isCurrentUser && !isLoading && !loadingRelationship && !relationshipError && blockStatus ? (
            <motion.div className="w-full space-y-3" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.rowReveal}>
              {!isBlockedBy && (
                <div>
                  <button
                    onClick={onSendMessage}
                    disabled={hasBlocked}
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-bold text-primary-foreground transition-[color,background-color,transform] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:py-4"
                  >
                    <MessageCircle size={18} />
                    {localizeText("Nhắn tin")}
                  </button>
                </div>
              )}

              {hasBlocked ? (
                <button
                  onClick={handleUnblock}
                  type="button"
                  disabled={isBlockLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  <ShieldOff size={14} /> {isBlockLoading ? localizeText("Đang cập nhật...") : localizeText("Bỏ chặn người dùng này")}
                </button>
              ) : (
                <button
                  onClick={() => setIsBlockConfirmOpen(true)}
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-medium text-slate-400 transition-colors hover:bg-destructive/5 hover:text-destructive"
                >
                  <Shield size={14} /> {localizeText("Chặn người dùng này")}
                </button>
              )}
              <button
                onClick={() => setIsReportOpen(true)}
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-medium text-slate-400 transition-colors hover:bg-amber-500/5 hover:text-amber-400"
              >
                <Flag size={14} /> {localizeText("Báo cáo hồ sơ")}
              </button>
            </motion.div>
          ) : null}

          {isCurrentUser && (
            <motion.p className="text-xs font-bold text-muted-foreground uppercase italic opacity-60" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.rowReveal}>
              {localizeText("Đây là hồ sơ của bạn")}
            </motion.p>
          )}

          {loadingRelationship && (
            <motion.div className="flex items-center gap-2 text-muted-foreground" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.rowReveal}>
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs font-bold">{localizeText("Đang tải dữ liệu mối quan hệ...")}</span>
            </motion.div>
          )}
          {relationshipError && !loadingRelationship && (
            <motion.div
              role="alert"
              className="mt-3 flex w-full flex-col items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-center text-xs font-bold text-destructive"
              initial={UI_MOTION_CONFIG.initialState}
              animate={UI_MOTION_CONFIG.animateState}
              variants={UI_MOTION_VARIANTS.rowReveal}
            >
              <span>{relationshipError}</span>
              <button
                type="button"
                className="rounded-xl border border-destructive/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors hover:bg-destructive/10"
                onClick={() => setRelationshipRetryToken((value) => value + 1)}
              >
                {localizeText("Thử lại")}
              </button>
            </motion.div>
          )}
        </motion.div>
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
    </div>
  );
};
