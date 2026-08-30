import { Search } from "lucide-react";
import { Input } from "@/shared/ui/Input";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";

interface SidebarSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export const SidebarSearchBar = ({ value, onChange }: SidebarSearchBarProps) => {
  return (
    <div className="px-4 pb-3 md:pt-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={MESSENGER_COPY.sidebar.search.placeholder}
          className="border-white/10 bg-white/5 pl-10 pr-3 text-foreground placeholder:text-muted-foreground focus-visible:border-primary/60"
        />
      </div>
    </div>
  );
};

export default SidebarSearchBar;
