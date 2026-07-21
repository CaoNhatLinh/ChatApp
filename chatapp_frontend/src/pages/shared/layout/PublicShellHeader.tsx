import { Link, NavLink } from "react-router-dom";
import { MessageCircle, Search, Shield, Users } from "lucide-react";
import { ThemeToggle } from "@/features/settings/ui/ThemeToggle";
import { cn } from "@/shared/lib/cn";
import { type ReactNode } from "react";
import { UI_COPY } from "@/shared/constants/ui-copy";

interface PublicShellHeaderProps {
  title?: string;
  topClassName?: string;
  actions?: ReactNode;
}

const primaryNavItems = UI_COPY.shell.navPublic;

const PublicShellHeader = ({
  title = UI_COPY.brand,
  topClassName,
  actions,
}: PublicShellHeaderProps) => {
  const defaultActions = (
    <>
      <Link
        to="/messages"
        className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] hover:border-primary hover:text-primary transition-all"
      >
        <MessageCircle size={14} />
        {UI_COPY.shell.publicActions.chat}
      </Link>
      <Link
        to="/login"
        className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-all hover:bg-primary hover:text-primary-foreground"
      >
        {UI_COPY.shell.publicActions.login}
      </Link>
      <Link
        to="/register"
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-all hover:scale-[1.01]"
      >
        {UI_COPY.shell.publicActions.register}
      </Link>
    </>
  );

  return (
    <header
      className={cn(
        "relative z-10 layout-shell flex items-center justify-between gap-4 py-5 sm:py-6",
        "rounded-[1.1rem] border border-border/40 bg-card/55 px-3 backdrop-blur-md",
        topClassName,
      )}
    >
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="font-serif text-xl font-black tracking-[-0.02em] transition-colors hover:text-primary"
        >
          {title}
        </Link>
        <nav
          aria-label="Điều hướng công khai"
          className="flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-2 py-1 min-w-0 overflow-x-auto"
        >
          {primaryNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] transition-colors whitespace-nowrap",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-primary",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <Link
          to="/friends"
          className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-primary transition-colors"
          title={UI_COPY.shell.publicHeaderLinks.friendHint}
        >
          <Users size={13} />
          <span className="hidden sm:inline">{UI_COPY.shell.publicActions.friends}</span>
        </Link>
        <Link
          to="/privacy"
          className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-primary transition-colors"
          title={UI_COPY.shell.publicHeaderLinks.privacyHint}
        >
          <Shield size={13} />
          <span>{UI_COPY.shell.publicActions.privacy}</span>
        </Link>
        <Link
          to="/search"
          className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-primary transition-colors"
          title={UI_COPY.shell.publicHeaderLinks.searchHint}
        >
          <Search size={13} />
          <span className="hidden sm:inline">{UI_COPY.shell.publicActions.search}</span>
        </Link>
        <div className="flex flex-wrap justify-end gap-2 sm:gap-3">
          {actions ?? defaultActions}
        </div>
      </div>
    </header>
  );
};

export default PublicShellHeader;
