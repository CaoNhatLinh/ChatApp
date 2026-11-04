import { Search } from "lucide-react";
import { Input } from "@/shared/ui/Input";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import { ConversationQuickOpen } from './components/ConversationQuickOpen';

interface SidebarSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export const SidebarSearchBar = ({ value, onChange }: SidebarSearchBarProps) => {
  return (
    <div className="sidebar-search flex items-center gap-1 px-4 pb-3 md:pt-5">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          maxLength={100}
          aria-label={MESSENGER_COPY.sidebar.search.placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={MESSENGER_COPY.sidebar.search.placeholder}
          className="border-border/70 bg-background/55 pl-10 pr-3 text-foreground placeholder:text-muted-foreground focus-visible:border-primary"
        />
      </div>
      <ConversationQuickOpen />
    </div>
  );
};

export default SidebarSearchBar;
