import { Menu, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useCallback } from "react";

interface MessengerLayoutShellProps {
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export const MessengerLayoutShell = ({
  isSidebarOpen,
  setSidebarOpen,
  sidebar,
  children,
}: MessengerLayoutShellProps) => {
  const handleOverlayClick = useCallback(() => {
    setSidebarOpen(false);
  }, [setSidebarOpen]);

  return (
    <section className="h-full w-full overflow-hidden bg-background text-foreground relative">
      <button
        onClick={() => setSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 h-10 w-10 surface rounded-full flex items-center justify-center text-primary"
        aria-label={isSidebarOpen ? "Đóng danh sách" : "Mở danh sách"}
        type="button"
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <div className="h-full w-full flex relative">
        <div
          className={cn(
            "absolute inset-y-0 left-0 z-40 w-full max-w-[320px] bg-background border-r border-border/50",
            "transition-transform duration-220 ease-out md:static md:translate-x-0 md:max-w-[340px]",
            "flex-shrink-0",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebar}
        </div>

        {isSidebarOpen ? (
          <button
            onClick={handleOverlayClick}
            className="md:hidden fixed inset-0 z-30 bg-foreground/25 backdrop-blur-sm"
            aria-label="Đóng danh sách"
            type="button"
          />
        ) : null}

        <div className="relative flex-1 h-full overflow-hidden">{children}</div>
      </div>
    </section>
  );
};

export default MessengerLayoutShell;
