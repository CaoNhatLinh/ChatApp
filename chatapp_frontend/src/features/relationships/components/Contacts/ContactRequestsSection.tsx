import { UserPlus } from "lucide-react";
import { EmptyState, SurfacePanel, SectionHeader } from "@/shared/ui";
import { FRIEND_COPY } from "@/features/relationships/constants/friends.constants";
import { ContactRow } from "./ContactRow";
import { FriendsListSkeleton } from "./ContactListSkeletons";
import { UI_MOTION_VARIANTS, UI_MOTION_CONFIG } from "@/shared/constants/ui-motion-variants";
import { motion } from "framer-motion";
import type { UserDTO } from "@/entities/user/model/user.types";

interface ContactRequestsSectionProps {
  requests: UserDTO[];
  isLoading: boolean;
  onAccept: (userId: string) => void;
  onReject: (userId: string) => void;
  onUserClick: (userId: string) => void;
}

export const ContactRequestsSection = ({
  requests,
  isLoading,
  onAccept,
  onReject,
  onUserClick,
}: ContactRequestsSectionProps) => {
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
        title={FRIEND_COPY.sectionTitle.requests}
        description={`${requests.length}${FRIEND_COPY.filters.requestCountSuffix}`}
      />

      {requests.length === 0 ? (
        <SurfacePanel>
          <EmptyState
            icon={<UserPlus size={18} className="text-primary" />}
            title={FRIEND_COPY.filters.noRequestsEmpty}
            description={FRIEND_COPY.filters.noRequestsHint}
          />
        </SurfacePanel>
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => (
            <ContactRow
              key={request.userId}
              userId={request.userId}
              displayName={request.displayName}
              userName={request.userName}
              avatarUrl={request.avatarUrl}
              onUserClick={onUserClick}
              subtitle={FRIEND_COPY.row.requestSent}
              actions={
                <div className="flex gap-2">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onAccept(request.userId);
                    }}
                    className="rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary-foreground"
                    type="button"
                  >
                    {FRIEND_COPY.actions.accept}
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onReject(request.userId);
                    }}
                    className="rounded-xl border border-border/50 px-4 py-2 text-[10px] font-black uppercase tracking-widest"
                    type="button"
                  >
                    {FRIEND_COPY.actions.reject}
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

export default ContactRequestsSection;
