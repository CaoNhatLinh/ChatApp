import { NavLink, Link } from "react-router-dom";
import { MessageCircle, Search, Settings, UserRound, Users, Bell } from "lucide-react";
import { ThemeToggle } from "@/features/settings/ui/ThemeToggle";
import { cn } from "@/shared/lib/cn";
import { type ReactNode } from "react";
import { UI_COPY } from "@/shared/constants/ui-copy";

interface AppShellHeaderProps {
  title?: string;
  actions?: ReactNode;
}

const appShellNavItems = [
  { to: "/app", label: UI_COPY.shell.navApp[0].label, icon: MessageCircle },
  { to: "/friends", label: UI_COPY.shell.navApp[1].label, icon: Users },
  { to: "/search", label: UI_COPY.shell.navApp[2].label, icon: Search },
  { to: "/activity", label: UI_COPY.shell.navApp[3].label, icon: Bell },
  { to: "/profile", label: UI_COPY.shell.navApp[4].label, icon: UserRound },
  { to: "/settings", label: UI_COPY.shell.navApp[5].label, icon: Settings },
];

export const AppShellHeader = ({ title = UI_COPY.brand, actions }: AppShellHeaderProps) => {
  return (
    <header className="relative z-10 layout-shell py-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] bg-card/60 p-2 backdrop-blur-md ring-1 ring-border/50 border border-border/40">
      <Link
        to="/app"
        className="font-serif text-lg md:text-xl font-black tracking-[-0.02em] transition-colors hover:text-primary"
      >
        {title}
      </Link>

      <nav
        aria-label="Điều hướng nội bộ ứng dụng"
        className="flex flex-1 items-center gap-1 overflow-x-auto py-1 pl-1 pr-2 rounded-full border border-border/60 bg-background/75 scrollbar-hide"
      >
        {appShellNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all",
                  isActive
                    ? "text-primary bg-primary/10 border border-primary/25"
                    : "text-muted-foreground/85 hover:text-primary hover:bg-primary/10",
                )
              }
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        {actions}
      </div>
    </header>
  );
};

export default AppShellHeader;

