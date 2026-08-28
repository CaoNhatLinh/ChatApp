import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/features/settings/ui/ThemeToggle";
import { cn } from "@/shared/lib/cn";
import { type ReactNode } from "react";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { BrandMark } from "@/shared/ui/Brand";
import { LanguageToggle } from "@/shared/ui/LanguageToggle";
import { useAppLocale } from "@/shared/i18n";

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
  const pathname = usePathname();
  useAppLocale();
  const defaultActions = (
    <>
      <Link
        href="/login"
        className="focus-ring inline-flex items-center rounded-[var(--radius-md)] border border-border bg-transparent px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
      >
        {UI_COPY.shell.publicActions.login}
      </Link>
      <Link
        href="/register"
        className="focus-ring inline-flex items-center rounded-[var(--radius-md)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
      >
        {UI_COPY.shell.publicActions.register}
      </Link>
    </>
  );

  return (
    <header className={cn("site-nav sticky top-0 z-30", topClassName)}>
      <div className="layout-shell flex w-full items-center justify-between gap-6 py-3">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            href="/"
            className="focus-ring flex shrink-0 items-center gap-2 text-base font-bold tracking-[-0.02em] transition-colors hover:text-primary"
          >
            <BrandMark />
            <span>{title}</span>
          </Link>
          <nav aria-label="Điều hướng công khai" className="hidden items-center gap-1 md:flex">
            {primaryNavItems.map((item) => (
              <Link
                key={item.to}
                href={item.to}
                className={
                  cn(
                    "focus-ring rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                    pathname === item.to
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageToggle />
          <ThemeToggle />
          <div className="hidden flex-wrap justify-end gap-2 sm:flex">
            {actions ?? defaultActions}
          </div>
          <Link href="/register" className="focus-ring inline-flex rounded-[var(--radius-md)] bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground sm:hidden">
            {UI_COPY.shell.publicActions.register}
          </Link>
        </div>
      </div>
    </header>
  );
};

export default PublicShellHeader;
