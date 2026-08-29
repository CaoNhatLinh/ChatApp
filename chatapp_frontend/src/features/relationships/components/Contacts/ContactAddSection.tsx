import { UserPlus } from "lucide-react";
import { EmptyState, SurfacePanel, SkeletonLine, Skeleton } from "@/shared/ui";
import { FRIEND_COPY } from "@/features/relationships/constants/friends.constants";
import { ContactRowSkeleton } from "./ContactListSkeletons";
import { Button } from "@/shared/ui/Button";
import { UI_MOTION_VARIANTS, UI_MOTION_CONFIG } from "@/shared/constants/ui-motion-variants";
import { motion } from "framer-motion";
import type { UserDTO } from "@/entities/user/model/user.types";
import { ContactRow } from "./ContactRow";

interface ContactAddSectionProps {
  searchResults: (UserDTO & { requestSent?: boolean; isFriend?: boolean })[];
  friendsIds: Set<string>;
  pendingIds: Set<string>;
  isLoading: boolean;
  actionTargetId: string | null;
  globalSearchQuery: string;
  onSearchChange: (value: string) => void;
  onUserClick: (userId: string) => void;
  onSendRequest: (userId: string) => void;
  onCancelRequest: (userId: string) => void;
  currentUserId?: string;
}

export const ContactAddSection = ({
  searchResults,
  friendsIds,
  pendingIds,
  isLoading,
  actionTargetId,
  globalSearchQuery,
  onSearchChange,
  onUserClick,
  onSendRequest,
  onCancelRequest,
  currentUserId,
}: ContactAddSectionProps) => {
  return (
    <motion.section
      className="space-y-6"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.panelReveal}
    >
      <SurfacePanel className="border border-border/30">
        <div className="space-y-2">
          <h3 className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">
            {FRIEND_COPY.sectionTitle.add}
          </h3>
          <div className="rounded border border-border/40 px-3 py-2 text-sm text-muted-foreground">
            <input
              value={globalSearchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={FRIEND_COPY.filters.searchPlaceholder}
              className="w-full bg-transparent outline-none"
            />
          </div>
        </div>
      </SurfacePanel>

      {isLoading ? <ContactRowSkeleton /> : null}

      {globalSearchQuery.length > 0 ? (
        <>
          <h4 className="font-black uppercase tracking-[0.2em] text-xs text-muted-foreground">
            {FRIEND_COPY.filters.resultsCountLabel} ({searchResults.length})
          </h4>

          {searchResults.length > 0 ? (
            <div className="space-y-3">
              {searchResults.map((person) => (
                <ContactRow
                  key={person.userId}
                  userId={person.userId}
                  displayName={person.displayName}
                  userName={person.userName}
                  avatarUrl={person.avatarUrl}
                  onUserClick={onUserClick}
                  subtitle={
                    person.isFriend || friendsIds.has(person.userId)
                      ? FRIEND_COPY.row.alreadyFriend
                      : person.requestSent || pendingIds.has(person.userId)
                        ? FRIEND_COPY.row.requestSent
                        : undefined
                  }
                  actions={
                    <div>
                      {person.userId === currentUserId ? (
                        <span className="inline-flex rounded-2xl border border-border/50 bg-muted px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          {FRIEND_COPY.row.self}
                        </span>
                      ) : person.isFriend || friendsIds.has(person.userId) ? (
                        <span className="inline-flex rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary">
                          {FRIEND_COPY.row.alreadyFriend}
                        </span>
                      ) : person.requestSent || pendingIds.has(person.userId) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          loading={actionTargetId === person.userId}
                          disabled={actionTargetId !== null}
                          aria-busy={actionTargetId === person.userId}
                          onClick={() => onCancelRequest(person.userId)}
                        >
                          {FRIEND_COPY.actions.cancel}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          loading={actionTargetId === person.userId}
                          disabled={actionTargetId !== null}
                          aria-busy={actionTargetId === person.userId}
                          onClick={() => onSendRequest(person.userId)}
                        >
                          <UserPlus size={16} className="mr-1" aria-hidden="true" />
                          {FRIEND_COPY.row.send}
                        </Button>
                      )}
                    </div>
                  }
                />
              ))}
            </div>
          ) : (
            <SurfacePanel>
              <EmptyState
                icon={<UserPlus size={18} className="text-primary" />}
                title={FRIEND_COPY.status.notFound}
                description={FRIEND_COPY.filters.noSearchResultText}
              />
            </SurfacePanel>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <motion.div
            initial={UI_MOTION_CONFIG.initialState}
            animate={UI_MOTION_CONFIG.animateState}
            variants={UI_MOTION_VARIANTS.panelReveal}
          >
            <SkeletonLine className="mx-auto h-4 w-2/3" />
            <p className="text-sm mt-3">{FRIEND_COPY.filters.noSearchHint}</p>
            <Skeleton className="mt-3 h-2 w-1/2 mx-auto" />
          </motion.div>
        </div>
      )}

      {isLoading ? (
        <motion.div
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.rowReveal}
        >
          <Skeleton className="h-6 w-full" />
        </motion.div>
      ) : null}
    </motion.section>
  );
};

export default ContactAddSection;

