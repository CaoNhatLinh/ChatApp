import { Search } from "lucide-react";
import { Input } from "@/shared/ui/Input";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";

interface SidebarSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export const SidebarSearchBar = ({ value, onChange }: SidebarSearchBarProps) => {
  return (
    <div className="px-4 pb-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={MESSENGER_COPY.sidebar.search.placeholder}
          className="pl-10 pr-3"
        />
      </div>
    </div>
  );
};

export default SidebarSearchBar;
