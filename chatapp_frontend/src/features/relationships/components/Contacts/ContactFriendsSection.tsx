import { MessageCircle, X } from "lucide-react";
import { SurfacePanel, SectionHeader } from "@/shared/ui";
import { FRIEND_COPY } from "@/features/relationships/constants/friends.constants";
import { ContactRow } from "./ContactRow";
import { FriendsListSkeleton } from "./ContactListSkeletons";
import { UI_MOTION_VARIANTS, UI_MOTION_CONFIG } from "@/shared/constants/ui-motion-variants";
import { motion } from "framer-motion";
import type { User } from "@/features/messenger/types/messenger.types";

interface ContactFriendsSectionProps {
  title: string;
  friendsCount: number;
  visibleFriends: User[];
  isLoading: boolean;
  onOpenChat: (userId: string) => void;
  onUnfriend: (userId: string) => void;
  onUserClick: (userId: string) => void;
  onAddShortcut?: () => void;
}

export const ContactFriendsSection = ({
  title,
  friendsCount,
  visibleFriends,
  isLoading,
  onOpenChat,
  onUnfriend,
  onUserClick,
  onAddShortcut,
}: ContactFriendsSectionProps) => {
  if (isLoading) {
    return <FriendsListSkeleton />;
  }

  return (
    <motion.section
      className="space-y-4"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.panelReveal}
    >
      <SectionHeader
        title={title}
        description={`${friendsCount}${FRIEND_COPY.filters.friendCountSuffix}`}
      />

      {visibleFriends.length === 0 ? (
        <SurfacePanel className="surface-elevated">
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            {FRIEND_COPY.filters.noFriendsEmpty}
          </div>
          <div className="mt-4 flex justify-center">
            {onAddShortcut ? (
              <button
                type="button"
                onClick={onAddShortcut}
                className="rounded-xl border border-border/60 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
              >
                {FRIEND_COPY.tabs.add}
              </button>
            ) : null}
          </div>
        </SurfacePanel>
      ) : (
        <div className="grid gap-3">
          {visibleFriends.map((friend) => (
            <ContactRow
              key={friend.userId}
              userId={friend.userId}
              displayName={friend.displayName}
              userName={friend.userName}
              avatarUrl={friend.avatarUrl}
              onUserClick={onUserClick}
              presenceScope={null}
              actions={
                <div className="flex gap-2 sm:opacity-100">
                  <button
                    type="button"
                    className="rounded-xl border border-border/50 bg-background px-4 py-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                    title={FRIEND_COPY.actions.openChat}
                    aria-label={FRIEND_COPY.actions.openChat}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenChat(friend.userId);
                    }}
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-border/50 bg-background px-4 py-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title={FRIEND_COPY.actions.unfriend}
                    aria-label={FRIEND_COPY.actions.unfriend}
                    onClick={(event) => {
                      event.stopPropagation();
                      onUnfriend(friend.userId);
                    }}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}
    </motion.section>
  );
};

export default ContactFriendsSection;
