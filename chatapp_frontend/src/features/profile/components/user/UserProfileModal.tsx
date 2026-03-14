
import React, { useState, useEffect, useCallback } from 'react';
import { X, User, Calendar, MessageCircle, UserPlus, UserMinus, Shield, Crown, Ban, Loader2, ShieldOff } from 'lucide-react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useIsUserOnline } from '@/features/presence/model/presence.store';
import { useFriendStore } from '@/features/relationships/model/friend.store';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/Avatar';
import { friendApi } from '@/features/relationships/api/friends.api';
import type { UserProfileModal as UserProfile } from '@/entities/conversation/model/room.types';
import type { UserDTO } from '@/entities/user/model/user.types';
import { cn } from '@/shared/lib/cn';
import { format } from 'date-fns';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSendMessage?: () => void;
  onAddFriend?: () => void;
  onRemoveFriend?: () => void;
  onBlock?: () => void;
  onUnblock?: () => void;
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
  userProfile,
  isLoading = false
}) => {
  const { user: currentUser } = useAuthStore();
  const isOnline = useIsUserOnline(userId);
  const { blockFriend, unblockFriend, mutualFriends, fetchMutualFriends, getIsFriend, loadingMutual } = useFriendStore();

  const [isFriend, setIsFriend] = useState(false);
  const [blockStatus, setBlockStatus] = useState<{ hasBlocked: boolean; isBlockedBy: boolean } | null>(null);
  const [loadingRelationship, setLoadingRelationship] = useState(false);

  const isCurrentUser = currentUser?.userId === userId;

  useEffect(() => {
    if (!isOpen || !userId || isCurrentUser) return;

    let isMounted = true;
    setLoadingRelationship(true);

    const fetchRelationship = async () => {
      try {
        const status = await friendApi.checkBlockStatus(userId);
        if (isMounted) setBlockStatus(status);

        if (currentUser?.userId) {
          // Optimized: Use store cache for isFriend check
          if (isMounted) setIsFriend(getIsFriend(userId));
          
          await fetchMutualFriends(userId);
        }
      } catch (error) {
        console.error('[UserProfileModal] Failed to fetch relationship:', error);
      } finally {
        if (isMounted) setLoadingRelationship(false);
      }
    };

    void fetchRelationship();
    return () => { isMounted = false; };
  }, [isOpen, userId, isCurrentUser, currentUser?.userId, fetchMutualFriends, getIsFriend]);

  const handleBlock = useCallback(async () => {
    if (!confirm('Ban co chac chan muon chan nguoi dung nay?')) return;

    try {
      if (currentUser?.userId) {
        await blockFriend(userId);
        setBlockStatus({ hasBlocked: true, isBlockedBy: blockStatus?.isBlockedBy ?? false });
        setIsFriend(false);
        onBlock?.();
      }
    } catch (error) {
      console.error('[UserProfileModal] Failed to block:', error);
    }
  }, [currentUser?.userId, userId, blockFriend, blockStatus, onBlock]);

  const handleUnblock = useCallback(async () => {
    try {
      if (currentUser?.userId) {
        await unblockFriend(userId);
        setBlockStatus({ hasBlocked: false, isBlockedBy: blockStatus?.isBlockedBy ?? false });
        onUnblock?.();
      }
    } catch (error) {
      console.error('[UserProfileModal] Failed to unblock:', error);
    }
  }, [currentUser?.userId, userId, unblockFriend, blockStatus, onUnblock]);

  if (!isOpen) return null;

  const hasBlocked = blockStatus?.hasBlocked ?? false;
  const isBlockedBy = blockStatus?.isBlockedBy ?? false;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-background/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-card/60 glass rounded-[2.5rem] neo-shadow border border-border/50 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        <div className="h-32 bg-gradient-to-br from-primary/30 to-purple-500/30 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-background/50 hover:bg-background rounded-full transition-all text-muted-foreground hover:text-primary z-10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-8 pb-8 -mt-16 flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="w-32 h-32 rounded-[2.5rem] bg-card border-4 border-background overflow-hidden neo-shadow flex items-center justify-center font-black text-primary text-4xl uppercase">
              {isLoading ? (
                <Loader2 className="animate-spin" size={40} />
              ) : (
                userProfile?.avatarUrl ? (
                  <img src={userProfile.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  (userProfile?.displayName || userProfile?.username || "?").charAt(0)
                )
              )}
            </div>
            {!isLoading && (
              <div className={cn(
                "absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-background neo-shadow-sm",
                isOnline ? "bg-green-500" : "bg-muted-foreground"
              )} />
            )}
          </div>

          <div className="space-y-1 mb-8">
            <h2 className="text-2xl font-black uppercase tracking-tight">
              {isLoading ? "Dang tai..." : (userProfile?.displayName || userProfile?.username)}
            </h2>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-bold text-primary uppercase tracking-widest">
                @{userProfile?.username || "..."}
              </span>
              {userProfile?.role === 'admin' && (
                <div className="flex items-center gap-1 bg-yellow-400/10 text-yellow-500 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                  <Crown size={10} /> Admin
                </div>
              )}
            </div>

            {hasBlocked && (
              <div className="flex items-center justify-center gap-2 mt-2 px-3 py-1.5 bg-destructive/10 text-destructive rounded-xl text-xs font-bold">
                <Ban size={12} /> Ban da chan nguoi dung nay
              </div>
            )}
            {isBlockedBy && !hasBlocked && (
              <div className="flex items-center justify-center gap-2 mt-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-xl text-xs font-bold">
                <Shield size={12} /> Nguoi dung nay da chan ban
              </div>
            )}

            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pt-2">
              {isOnline ? 'Dang hoat dong' : 'Ngoai tuyen'}
            </p>
          </div>

          {/* Details Grid */}
          <div className="w-full grid grid-cols-2 gap-3 mb-8">
            <div className="p-3 rounded-2xl bg-background/30 border border-border/30 flex flex-col items-center gap-1">
              <Calendar size={14} className="text-primary/60" />
              <span className="text-[9px] font-bold uppercase text-muted-foreground">Tham gia</span>
              <span className="text-xs font-black">
                {userProfile?.joinedAt ? format(new Date(userProfile.joinedAt), 'MM/yyyy') : '...'}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-background/30 border border-border/30 flex flex-col items-center gap-1">
              <User size={14} className="text-primary/60" />
              <span className="text-[9px] font-bold uppercase text-muted-foreground">Ban chung</span>
              <span className="text-xs font-black">{userProfile?.mutualFriends || 0}</span>
            </div>
          </div>

          {!loadingMutual && !isCurrentUser && (mutualFriends?.userDetails?.length ?? 0) > 0 && (
            <div className="w-full mb-8 text-left">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1">
                Bạn chung ({mutualFriends?.userDetails.length})
              </h3>
              <div className="flex -space-x-2 overflow-hidden px-1">
                {mutualFriends?.userDetails.slice(0, 5).map((friend: UserDTO) => (
                  <Avatar key={friend.userId} className="h-8 w-8 border-2 border-background neo-shadow-sm" title={friend.displayName}>
                    <AvatarImage src={friend.avatarUrl || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {friend.displayName ? friend.displayName[0] : (friend.userName ? friend.userName[0] : '?')}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {(mutualFriends?.userDetails.length ?? 0) > 5 && (
                  <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground neo-shadow-sm">
                    +{(mutualFriends?.userDetails.length ?? 0) - 5}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!isCurrentUser && !isLoading && !loadingRelationship && (
            <div className="w-full space-y-3">
              {/* Main action row - only if not blocked by them */}
              {!isBlockedBy && (
                <div className="flex gap-2">
                  <button
                    onClick={onSendMessage}
                    disabled={hasBlocked}
                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-primary text-primary-foreground rounded-2xl text-xs font-black uppercase tracking-widest neo-shadow hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <MessageCircle size={18} />
                    Nhan tin
                  </button>

                  {!hasBlocked && (
                    !isFriend ? (
                      <button
                        onClick={onAddFriend}
                        className="flex items-center justify-center gap-2 px-6 py-4 bg-background border-2 border-primary/20 text-primary rounded-2xl text-xs font-black uppercase tracking-widest neo-shadow hover:bg-primary/5 transition-all"
                        title="Them ban"
                      >
                        <UserPlus size={18} />
                      </button>
                    ) : (
                      <button
                        onClick={onRemoveFriend}
                        className="flex items-center justify-center gap-2 px-6 py-4 bg-background border-2 border-destructive/20 text-destructive rounded-2xl text-xs font-black uppercase tracking-widest neo-shadow hover:bg-destructive/5 transition-all"
                        title="Huy ket ban"
                      >
                        <UserMinus size={18} />
                      </button>
                    )
                  )}
                </div>
              )}

              {/* Block/Unblock button */}
              {hasBlocked ? (
                <button
                  onClick={handleUnblock}
                  className="w-full flex items-center justify-center gap-2 py-3 text-primary hover:bg-primary/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <ShieldOff size={14} /> Bo chan nguoi dung nay
                </button>
              ) : (
                <button
                  onClick={handleBlock}
                  className="w-full flex items-center justify-center gap-2 py-3 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <Ban size={14} /> Chan nguoi dung nay
                </button>
              )}
            </div>
          )}

          {!isCurrentUser && loadingRelationship && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs font-bold">Dang tai...</span>
            </div>
          )}

          {isCurrentUser && (
            <p className="text-xs font-bold text-muted-foreground uppercase italic opacity-60">Day la ho so cua ban</p>
          )}
        </div>
      </div>
    </div>
  );
};
