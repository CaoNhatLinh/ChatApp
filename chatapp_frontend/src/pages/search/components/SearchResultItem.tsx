import { Link } from "react-router-dom";
import { cn } from "@/shared/lib/cn";
import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";

interface SearchResultItemProps {
  title: string;
  path: string;
  description: string;
  category: "chat" | "friends" | "settings" | "public";
  activeQuery: string;
}

const categoryTone: Record<SearchResultItemProps["category"], string> = {
  chat: "border-primary/40 bg-primary/5 text-primary",
  friends: "border-success/40 bg-success/8 text-success-foreground",
  settings: "border-warning/40 bg-warning/10 text-warning",
  public: "border-muted/50 bg-muted/30 text-muted-foreground",
};

export const SearchResultItem = ({ title, path, description, category, activeQuery }: SearchResultItemProps) => {
  const tokens = activeQuery.trim().length === 0
    ? [title]
    : title.split(new RegExp(`(${activeQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));

  return (
    <motion.li
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/60 bg-card/70 p-4 transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-soft",
        "pl-6",
        categoryTone[category]
      )}
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.rowReveal}
    >
      <span className={cn("absolute left-0 top-3 h-10 w-1 rounded-r-full", categoryTone[category].replace("border-", "bg-"))} />
      <Link to={path} className="block space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {tokens.map((chunk, index) => (
            <span key={`${path}-${index}`} className={chunk.toLowerCase() === activeQuery.trim().toLowerCase() ? "font-bold" : "font-semibold"}>
              {chunk}
            </span>
          ))}
        </p>
        <p className="text-xs text-muted-foreground leading-6">{description}</p>
      </Link>
    </motion.li>
  );
};

export default SearchResultItem;
