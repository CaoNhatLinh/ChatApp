import { Check, Loader2, Search, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { useUserSearch } from "@/shared/hooks/useUserSearch";
import { createConversation } from "@/features/messenger/api/messenger.api";
import { useMessenger } from "@/features/messenger/model/useMessenger";
import type { User } from "@/features/messenger/types/messenger.types";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import {
  UI_MOTION_CONFIG,
  UI_MOTION_VARIANTS,
} from "@/shared/constants/ui-motion-variants";

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewConversationModal = ({
  isOpen,
  onClose,
}: NewConversationModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const { searchResults, isSearching, setSearchResults } = useUserSearch(searchTerm);
  const { selectConversation, conversations } = useMessenger();
  const { user: currentUser } = useAuthStore();

  const selectedIds = useMemo(
    () => new Set(selectedUsers.map((user) => user.userId)),
    [selectedUsers],
  );

  const handleToggleUser = (user: User) => {
    setSelectedUsers((current) => {
      if (current.some((item) => item.userId === user.userId)) {
        return current.filter((item) => item.userId !== user.userId);
      }
      return [...current, user];
    });
  };

  const clearModalState = () => {
    setSearchTerm("");
    setSelectedUsers([]);
    setSearchResults([]);
  };

  const handleClose = () => {
    clearModalState();
    onClose();
  };

  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) return;

    setIsCreating(true);
    try {
      if (selectedUsers.length === 1) {
        const targetUserId = selectedUsers[0].userId;
        const existingDm = conversations.find(
          (conversation) =>
            conversation.type === "dm" &&
            conversation.otherParticipant?.userId === targetUserId,
        );

        if (existingDm) {
          await selectConversation(existingDm.conversationId);
          handleClose();
          return;
        }
      }

      const type = selectedUsers.length === 1 ? "dm" : "group";
      const name =
        type === "group"
          ? `${currentUser?.displayName || MESSENGER_COPY.chatWindow.roomTheme.defaultGroupName}-${selectedUsers.map((user) => user.displayName).join(", ")}`
          : undefined;

      const newConv = await createConversation({
        type,
        name,
        memberIds: selectedUsers.map((user) => user.userId),
      });

      await selectConversation(newConv.conversationId);
      handleClose();
    } catch (error) {
      console.error("Failed to create conversation", error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.button
        type="button"
        aria-label={MESSENGER_COPY.newConversationModal.closeAriaLabel}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleClose}
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.fadeIn}
      />

      <motion.section
        className="relative w-full max-w-md bg-card/95 border border-border/50 rounded-[1.25rem] overflow-hidden"
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.zoomReveal}
      >
        <header className="p-6 border-b border-border/50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">{MESSENGER_COPY.newConversationModal.title}</h2>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">
              {MESSENGER_COPY.newConversationModal.hint}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="rounded-full h-9 w-9"
          >
            <X size={20} />
          </Button>
        </header>

        <div className="p-6 space-y-6">
          <label className="relative block">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={MESSENGER_COPY.newConversationModal.searchPlaceholder}
              className="pl-10"
              disabled={isCreating}
            />
          </label>

          {selectedUsers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <span
                  key={user.userId}
                  className="inline-flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-bold"
                >
                  <span>{user.displayName}</span>
                  <button
                    onClick={() => handleToggleUser(user)}
                    className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                    type="button"
                    aria-label={`${MESSENGER_COPY.newConversationModal.removeChipAriaPrefix} ${user.displayName}`}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="min-h-[220px] max-h-[320px] overflow-y-auto custom-scrollbar -mx-2 px-2">
            {searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((user) => {
                  const isSelected = selectedIds.has(user.userId);
                  return (
                    <button
                      key={user.userId}
                      type="button"
                      onClick={() => handleToggleUser(user)}
                      className={`w-full flex items-center p-3 rounded-2xl border-2 transition-all ${
                        isSelected ? "bg-primary/10 border-primary/50" : "hover:bg-background/80 border-transparent"
                      }`}
                    >
                      <div className="relative mr-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden border-2 transition-colors ${
                            isSelected ? "border-primary bg-primary/10" : "border-primary/20 bg-primary/5"
                          }`}
                        >
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-primary font-black text-lg uppercase">
                              {user.displayName?.charAt(0)}
                            </span>
                          )}
                        </div>
                        {isSelected ? (
                          <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary text-primary-foreground rounded-full inline-flex items-center justify-center border border-background">
                            <Check size={12} strokeWidth={4} />
                          </span>
                        ) : null}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-foreground">{user.displayName}</p>
                        <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">@{user.userName}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : searchTerm.length >= 2 && !isSearching ? (
              <div className="flex flex-col items-center justify-center h-full text-center opacity-55 space-y-3 pt-8">
                <UserPlus size={40} className="text-muted-foreground" />
                <p className="font-bold uppercase tracking-widest text-sm">{MESSENGER_COPY.newConversationModal.noSearchResult}</p>
                <p className="text-xs text-muted-foreground">{MESSENGER_COPY.newConversationModal.searchRetryHint}</p>
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground pt-8">
                {MESSENGER_COPY.newConversationModal.minSearchHint}
              </div>
            )}
          </div>
        </div>

        <footer className="p-6 border-t border-border/50 bg-background/20">
          <Button
            onClick={() => void handleCreateConversation()}
            disabled={selectedUsers.length === 0 || isCreating}
            className="w-full"
          >
            {isCreating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{MESSENGER_COPY.newConversationModal.createButtonLoading}</span>
              </>
            ) : (
              <>
                <span>{MESSENGER_COPY.newConversationModal.createButton}</span>
                {selectedUsers.length > 0 ? (
                  <span className="bg-background/20 px-2 py-0.5 rounded-full text-xs">
                    {selectedUsers.length}
                  </span>
                ) : null}
              </>
            )}
          </Button>
        </footer>
      </motion.section>
    </div>
  );
};

export default NewConversationModal;
