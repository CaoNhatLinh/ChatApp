import { Bell, Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/shared/lib/cn";
import { useCallback } from "react";
import { localizeText, useAppLocale } from "@/shared/i18n";
import { Button } from "@/shared/ui/Button";
import { useNotificationStore } from "@/features/notifications/model/notification.store";

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
  const router = useRouter();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const handleOverlayClick = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

  return (
    <section lang={locale} className="messenger-workspace relative h-full w-full overflow-visible bg-background text-foreground">
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="hidden h-16 shrink-0 items-center border-b border-white/10 bg-[#0b141c]/95 px-5 backdrop-blur md:flex" aria-label={localizeText("Thanh điều hướng chung")}>
            <div className="ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => router.push("/app?notifications=1")}
                aria-label={localizeText("Thông báo")}
                title={localizeText("Thông báo")}
                className="relative rounded-full text-slate-300 hover:bg-white/8 hover:text-white"
              >
                <Bell size={19} />
                {unreadCount > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-[#0b141c]" aria-hidden="true" /> : null}
              </Button>
            </div>
          </header>
          <div className="relative min-h-0 flex-1 md:flex">
            <div
              className={cn(
                "absolute inset-y-0 left-0 z-40 w-full max-w-[320px] border-r border-border bg-background",
                "flex-shrink-0 transition-transform duration-200 ease-out md:static md:h-full md:w-[300px] md:max-w-none md:translate-x-0 md:transform-none",
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
        </div>
      </div>
    </section>
  );
};

export default MessengerLayoutShell;
