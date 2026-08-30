import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/features/settings/ui/ThemeToggle";
import { cn } from "@/shared/lib/cn";
import { type ReactNode } from "react";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { BrandMark } from "@/shared/ui/Brand";
import { LanguageToggle } from "@/shared/ui/LanguageToggle";
import { localizeText, useAppLocale } from "@/shared/i18n";

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useAppLocale();
  const defaultActions = (
    <>
      <Link
        href="/login"
        className="focus-ring inline-flex items-center rounded-[var(--radius-md)] border border-border bg-transparent px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
      >
        {localizeText(UI_COPY.shell.publicActions.login)}
      </Link>
      <Link
        href="/register"
        className="focus-ring inline-flex items-center rounded-[var(--radius-md)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
      >
        {localizeText(UI_COPY.shell.publicActions.register)}
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
          <nav aria-label={localizeText("Điều hướng công khai")} className="hidden items-center gap-1 md:flex">
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
                {localizeText(item.label)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageToggle />
          <ThemeToggle />
          <button
            type="button"
            className="focus-ring inline-flex items-center justify-center rounded-[var(--radius-md)] border border-border p-2 text-muted-foreground hover:border-primary hover:text-primary md:hidden"
            aria-expanded={mobileNavOpen}
            aria-controls="public-mobile-navigation"
            aria-label={localizeText(mobileNavOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng")}
            onClick={() => setMobileNavOpen((current) => !current)}
          >
            {mobileNavOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
          <div className="hidden flex-wrap justify-end gap-2 sm:flex">
            {actions ?? defaultActions}
          </div>
          <Link href="/register" className="focus-ring hidden rounded-[var(--radius-md)] bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground min-[28rem]:inline-flex sm:hidden">
            {localizeText(UI_COPY.shell.publicActions.register)}
          </Link>
        </div>
      </div>
      {mobileNavOpen ? (
        <div id="public-mobile-navigation" className="border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur md:hidden">
          <nav aria-label={localizeText("Điều hướng công khai trên thiết bị di động")} className="layout-shell grid gap-1">
            {primaryNavItems.map((item) => (
              <Link
                key={item.to}
                href={item.to}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  "focus-ring rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-semibold",
                  pathname === item.to ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {localizeText(item.label)}
              </Link>
            ))}
            <div className="mt-2 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
              <Link href="/login" onClick={() => setMobileNavOpen(false)} className="focus-ring rounded-[var(--radius-md)] border border-border px-3 py-2.5 text-center text-sm font-semibold hover:border-primary hover:text-primary">
                {localizeText(UI_COPY.shell.publicActions.login)}
              </Link>
              <Link href="/register" onClick={() => setMobileNavOpen(false)} className="focus-ring rounded-[var(--radius-md)] bg-primary px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground">
                {localizeText(UI_COPY.shell.publicActions.register)}
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
};

export default PublicShellHeader;
