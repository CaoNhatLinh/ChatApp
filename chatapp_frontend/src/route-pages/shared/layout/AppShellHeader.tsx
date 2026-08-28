import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Search, Settings, UserRound, Users } from "lucide-react";
import { ThemeToggle } from "@/features/settings/ui/ThemeToggle";
import { cn } from "@/shared/lib/cn";
import { type ReactNode } from "react";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { BrandMark } from "@/shared/ui/Brand";
import { LanguageToggle } from "@/shared/ui/LanguageToggle";
import { localizeText, useAppLocale } from "@/shared/i18n";

interface AppShellHeaderProps {
  title?: string;
  actions?: ReactNode;
}

const appShellNavItems = [
  { to: "/app", label: UI_COPY.shell.navApp[0].label, icon: MessageCircle },
  { to: "/friends", label: UI_COPY.shell.navApp[1].label, icon: Users },
  { to: "/search", label: UI_COPY.shell.navApp[2].label, icon: Search },
  { to: "/profile", label: UI_COPY.shell.navApp[3].label, icon: UserRound },
  { to: "/settings", label: UI_COPY.shell.navApp[4].label, icon: Settings },
];

export const AppShellHeader = ({ title = UI_COPY.brand, actions }: AppShellHeaderProps) => {
  const pathname = usePathname();
  useAppLocale();
  return (
    <header className="site-nav sticky top-0 z-30">
      <div className="layout-shell flex min-h-16 items-center gap-4 py-2">
        <Link href="/app" className="focus-ring flex shrink-0 items-center gap-2 text-base font-bold tracking-[-0.02em] hover:text-primary">
          <BrandMark />
          <span className="hidden sm:inline">{title}</span>
        </Link>
        <nav aria-label={localizeText("Điều hướng ứng dụng")} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {appShellNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                href={item.to}
                className={cn(
                  "focus-ring inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors",
                  pathname === item.to ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          {actions}
        </div>
      </div>
    </header>
  );
};

export default AppShellHeader;
