import { Search } from "lucide-react";
import { Input } from "@/shared/ui/Input";
import { FRIEND_COPY } from "@/features/relationships/constants/friends.constants";
import { type ContactListTab } from "@/features/relationships/hooks/useFriendTabsState";

interface ContactListHeaderProps {
  activeTab: ContactListTab;
  requestCount: number;
  showSearch: boolean;
  searchQuery: string;
  onTabChange: (tab: ContactListTab) => void;
  onSearchChange: (value: string) => void;
}

const tabs: Array<{ key: ContactListTab; label: string }> = [
  { key: "friends", label: FRIEND_COPY.tabs.friends },
  { key: "requests", label: FRIEND_COPY.tabs.requests },
  { key: "add", label: FRIEND_COPY.tabs.add },
];

export const ContactListHeader = ({
  activeTab,
  requestCount,
  showSearch,
  searchQuery,
  onTabChange,
  onSearchChange,
}: ContactListHeaderProps) => {
  return (
    <header className="surface sticky top-0 z-20 border-b border-border px-4 py-4 sm:px-6 sm:py-0 sm:h-20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2 sm:gap-4 sm:flex-row sm:items-center sm:flex-nowrap">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{FRIEND_COPY.sectionTitle.friendsHeader}</h2>
        <div className="hidden sm:block h-6 w-px bg-border/50 mx-2" />
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`rounded-md px-3 py-2 sm:px-4 sm:py-2 font-medium text-xs transition-[color,background-color,border-color,box-shadow,transform,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-primary/10 hover:text-foreground"
              }`}
              type="button"
            >
              {tab.label}
              {tab.key === "requests" && requestCount > 0 ? (
                <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px]">
                  {requestCount > 99 ? "99+" : requestCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {showSearch ? (
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
            <Search size={16} />
          </div>
          <Input
            type="text"
            aria-label={FRIEND_COPY.filters.searchPlaceholder}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={FRIEND_COPY.filters.searchPlaceholder}
            className="pl-10"
          />
        </div>
      ) : null}
    </header>
  );
};

export default ContactListHeader;

