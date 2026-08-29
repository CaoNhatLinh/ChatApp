import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Crown, Flag, Loader2, MessageCircle, Shield, ShieldOff, User, UserMinus, UserPlus, X } from "lucide-react";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { usePresence } from "@/features/presence/model/presence.store";
import { useTrackPresence } from "@/features/presence/hooks/useTrackPresence";
import { StatusDot } from "@/features/presence/ui/StatusSelector";
import { useFriendStore } from "@/features/relationships/model/friend.store";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/Avatar";
import { friendApi } from "@/features/relationships/api/friends.api";
import type { UserProfileModal as UserProfile } from "@/shared/types/room.types";
import type { UserDTO } from "@/entities/user/model/user.types";
import { format } from "date-fns";
import { notifyError, notifySuccess } from "@/shared/lib/notification";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";
import { ReportUserModal } from "./ReportUserModal";
import { localizeText } from '@/shared/i18n';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSendMessage?: () => void;
  onAddFriend?: () => void;
  onRemoveFriend?: () => void;
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
  onSendMessage,
  onAddFriend,
  onRemoveFriend,
  onBlock,
  onUnblock,
  onReport,
  userProfile,
  isLoading = false,
}) => {
  const { user: currentUser } = useAuthStore();
  const { presence } = usePresence(userId);
  useTrackPresence(isOpen ? [userId] : []);
  const isOnline = presence?.isOnline ?? false;
  const status = presence?.status ?? "OFFLINE";
  const { blockFriend, unblockFriend, mutualFriends, fetchMutualFriends, getIsFriend, loadingMutual } = useFriendStore();

  const [isFriend, setIsFriend] = useState(false);
  const [blockStatus, setBlockStatus] = useState<{ hasBlocked: boolean; isBlockedBy: boolean } | null>(null);
  const [loadingRelationship, setLoadingRelationship] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isBlockConfirmOpen, setIsBlockConfirmOpen] = useState(false);
  const [isBlockLoading, setIsBlockLoading] = useState(false);

  const isCurrentUser = currentUser?.userId === userId;

  useEffect(() => {
    if (!isOpen || !userId || isCurrentUser) return;

    let isMounted = true;
    setLoadingRelationship(true);

    const fetchRelationship = async () => {
      try {
        const relationship = await friendApi.checkBlockStatus(userId);
        if (isMounted) {
          setBlockStatus(relationship);
          setIsFriend(getIsFriend(userId));
        }
        if (currentUser?.userId) {
          await fetchMutualFriends(userId);
        }
      } catch (error) {
        console.error("[UserProfileModal] Failed to fetch relationship:", error);
        notifyError(localizeText("Không thể tải dữ liệu hồ sơ liên quan."));
      } finally {
        if (isMounted) setLoadingRelationship(false);
      }
    };

    void fetchRelationship();
    return () => {
      isMounted = false;
    };
  }, [getIsFriend, currentUser?.userId, fetchMutualFriends, isCurrentUser, isOpen, userId]);

  useEffect(() => {
    if (!isOpen) setIsReportOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleBlock = useCallback(async () => {
    try {
      if (!currentUser?.userId) return;
      setIsBlockLoading(true);
      await blockFriend(userId);
      setBlockStatus({ hasBlocked: true, isBlockedBy: blockStatus?.isBlockedBy ?? false });
      setIsFriend(false);
      setIsBlockConfirmOpen(false);
      notifySuccess(localizeText("Đã chặn người dùng này."));
      onBlock?.();
    } catch (error) {
      console.error("[UserProfileModal] Failed to block:", error);
      notifyError(localizeText("Không thể chặn người dùng."));
    } finally {
      setIsBlockLoading(false);
    }
  }, [blockFriend, blockStatus?.isBlockedBy, currentUser?.userId, onBlock, userId]);

  const handleUnblock = useCallback(async () => {
    try {
      if (!currentUser?.userId) return;
      await unblockFriend(userId);
      setBlockStatus({ hasBlocked: false, isBlockedBy: blockStatus?.isBlockedBy ?? false });
      notifySuccess(localizeText("Đã bỏ chặn người dùng này."));
      onUnblock?.();
    } catch (error) {
      console.error("[UserProfileModal] Failed to unblock:", error);
      notifyError(localizeText("Không thể bỏ chặn người dùng."));
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-profile-title"
        className="relative w-full max-w-[95vw] sm:max-w-md bg-card/60 glass rounded-[2rem] sm:rounded-[2.5rem] neo-shadow border border-border/50 overflow-hidden flex flex-col"
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.zoomReveal}
      >
        <div className="h-28 sm:h-32 bg-gradient-to-br from-primary/30 to-purple-500/30 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-background/50 hover:bg-background rounded-full transition-[color,background-color,border-color,box-shadow,transform,opacity] text-muted-foreground hover:text-primary z-10"
            type="button"
            aria-label={localizeText("Đóng hồ sơ")}
          >
            <X size={20} />
          </button>
        </div>

        <motion.div
          className="px-6 sm:px-8 pb-8 -mt-14 sm:-mt-16 flex flex-col items-center text-center"
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.panelReveal}
        >
          <motion.div className="relative mb-6" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.rowReveal}>
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-[2rem] sm:rounded-[2.5rem] bg-card border-4 border-background overflow-hidden neo-shadow flex items-center justify-center font-black text-primary text-4xl uppercase">
              {isLoading ? (
                <Loader2 className="animate-spin" size={40} />
              ) : (
                userProfile?.avatarUrl ? (
                  <img src={userProfile.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  userProfile?.displayName.charAt(0)
                )
              )}
            </div>
            {!isLoading ? (
              <StatusDot
                status={status}
                isOnline={isOnline}
                size="lg"
                className="absolute -bottom-1 right-2 border-4 border-background"
              />
            ) : null}
          </motion.div>

          <motion.div className="space-y-1 mb-6" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.rowReveal}>
            <h2 id="user-profile-title" className="text-xl sm:text-2xl font-black uppercase tracking-tight">
              {isLoading ? localizeText("Đang tải...") : userProfile?.displayName}
            </h2>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-bold text-primary uppercase tracking-widest">@{userProfile?.username}</span>
              {userProfile?.role === "admin" ? (
                <div className="flex items-center gap-1 bg-yellow-400/10 text-yellow-500 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                  <Crown size={10} /> Admin
                </div>
              ) : null}
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pt-2">
              {isOnline ? localizeText("Đang hoạt động") : localizeText("Ngoại tuyến")}
            </p>
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
            <div className="p-3 rounded-2xl bg-background/30 border border-border/30 flex flex-col items-center gap-1">
              <Calendar size={14} className="text-primary/60" />
              <span className="text-[9px] font-bold uppercase text-muted-foreground">{localizeText("Tham gia")}</span>
              <span className="text-xs font-black">
                {userProfile?.joinedAt ? format(new Date(userProfile.joinedAt), "MM/yyyy") : null}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-background/30 border border-border/30 flex flex-col items-center gap-1">
              <User size={14} className="text-primary/60" />
              <span className="text-[9px] font-bold uppercase text-muted-foreground">{localizeText("Bạn chung")}</span>
              <span className="text-xs font-black">{mutualFriends?.userDetails.length ?? null}</span>
            </div>
          </motion.div>

          {!loadingMutual && !isCurrentUser && (mutualFriends?.userDetails?.length ?? 0) > 0 ? (
            <motion.div className="w-full mb-8 text-left" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.panelReveal}>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1">
                {localizeText("Bạn chung")} ({mutualFriends?.userDetails.length})
              </h3>
              <div className="flex -space-x-2 overflow-hidden px-1">
                {mutualFriends?.userDetails.slice(0, 5).map((friend: UserDTO) => (
                <Avatar key={friend.userId} className="h-8 w-8 border-2 border-background neo-shadow-sm" title={friend.displayName}>
                    <AvatarImage src={friend.avatarUrl} />
                    <AvatarFallback className="text-[10px]">
                      {friend.displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {(mutualFriends?.userDetails.length ?? 0) > 5 && (
                  <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground neo-shadow-sm">
                    +{(mutualFriends?.userDetails.length ?? 0) - 5}
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}

          {!isCurrentUser && !isLoading && !loadingRelationship ? (
            <motion.div className="w-full space-y-3" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.rowReveal}>
              {!isBlockedBy && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={onSendMessage}
                    disabled={hasBlocked}
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 py-3 sm:py-4 bg-primary text-primary-foreground rounded-2xl text-xs font-black uppercase tracking-widest neo-shadow hover:scale-105 active:scale-95 transition-[color,background-color,border-color,box-shadow,transform,opacity] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <MessageCircle size={18} />
                    {localizeText("Nhắn tin")}
                  </button>

                  {!hasBlocked && (
                    <>
                      {!isFriend ? (
                        <button
                          onClick={onAddFriend}
                          type="button"
                          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 sm:py-4 bg-background border-2 border-primary/20 text-primary rounded-2xl text-xs font-black uppercase tracking-widest neo-shadow hover:bg-primary/5 transition-[color,background-color,border-color,box-shadow,transform,opacity]"
                          title={localizeText("Thêm bạn")}
                        >
                          <UserPlus size={18} />
                        </button>
                      ) : (
                        <button
                          onClick={onRemoveFriend}
                          type="button"
                          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 sm:py-4 bg-background border-2 border-destructive/20 text-destructive rounded-2xl text-xs font-black uppercase tracking-widest neo-shadow hover:bg-destructive/5 transition-[color,background-color,border-color,box-shadow,transform,opacity]"
                          title={localizeText("Hủy kết bạn")}
                        >
                          <UserMinus size={18} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {hasBlocked ? (
                <button
                  onClick={handleUnblock}
                  type="button"
                  className="w-full flex items-center justify-center gap-2 py-3 text-primary hover:bg-primary/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-[color,background-color,border-color,box-shadow,transform,opacity]"
                >
                  <ShieldOff size={14} /> {localizeText("Bỏ chặn người dùng này")}
                </button>
              ) : (
                <button
                  onClick={() => setIsBlockConfirmOpen(true)}
                  type="button"
                  className="w-full flex items-center justify-center gap-2 py-3 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-[color,background-color,border-color,box-shadow,transform,opacity]"
                >
                  <Shield size={14} /> {localizeText("Chặn người dùng này")}
                </button>
              )}
              <button
                onClick={() => setIsReportOpen(true)}
                type="button"
                className="w-full flex items-center justify-center gap-2 py-3 text-muted-foreground/60 hover:text-amber-600 hover:bg-amber-500/5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-[color,background-color,border-color,box-shadow,transform,opacity]"
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
        </motion.div>
      </motion.div>

      {isReportOpen && userProfile ? (
        <ReportUserModal
          userId={userId}
          displayName={userProfile.displayName}
          onClose={() => setIsReportOpen(false)}
          onSubmitted={() => {
            setIsReportOpen(false);
            notifySuccess(localizeText("Đã gửi báo cáo hồ sơ. Cảm ơn bạn đã giúp giữ NovaChat an toàn."));
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
