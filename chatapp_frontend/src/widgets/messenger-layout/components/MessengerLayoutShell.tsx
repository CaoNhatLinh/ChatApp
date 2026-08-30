import { Menu, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useCallback } from "react";
import { localizeText, useAppLocale } from "@/shared/i18n";

interface MessengerLayoutShellProps {
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  mobileSidebarFullScreen?: boolean;
  showMobileMenu: boolean;
  navigationRail: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export const MessengerLayoutShell = ({
  isSidebarOpen,
  setSidebarOpen,
  mobileSidebarFullScreen = false,
  showMobileMenu,
  navigationRail,
  sidebar,
  children,
}: MessengerLayoutShellProps) => {
  const { locale } = useAppLocale();
  const handleOverlayClick = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

  return (
    <section lang={locale} className="messenger-workspace relative h-full w-full overflow-hidden bg-background text-foreground">
      {showMobileMenu ? <button
        onClick={() => setSidebarOpen(!isSidebarOpen)}
        className={cn("focus-ring surface fixed left-4 top-4 z-50 h-10 w-10 items-center justify-center rounded-full text-primary md:hidden", mobileSidebarFullScreen && isSidebarOpen ? "hidden" : "flex")}
        aria-label={isSidebarOpen ? localizeText("Đóng danh sách") : localizeText("Mở danh sách")}
        type="button"
      >
        {isSidebarOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button> : null}

      <div className="relative flex h-full w-full">
        {navigationRail}
        <div
          className={cn(
            "absolute inset-y-0 left-0 z-40 w-full max-w-[320px] border-r border-border bg-background",
            "flex-shrink-0 transition-transform duration-200 ease-out md:static md:w-[300px] md:max-w-none md:translate-x-0",
            mobileSidebarFullScreen ? "max-w-none" : "",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {sidebar}
        </div>

        {isSidebarOpen && !mobileSidebarFullScreen ? (
          <button onClick={handleOverlayClick} className="fixed inset-0 z-30 bg-foreground/20 md:hidden" aria-label={localizeText("Đóng danh sách")} type="button" />
        ) : null}

        <div className="relative h-full min-w-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </section>
  );
};

export default MessengerLayoutShell;
