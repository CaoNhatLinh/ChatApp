import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { ShellFrame } from "./ShellFrame";
import { AppNavigationRail } from "./AppNavigationRail";
import { AppGlobalHeader } from "./AppGlobalHeader";

interface AppPageShellProps {
  children: ReactNode;
  contentClassName?: string;
  fullWidth?: boolean;
  showNavigation?: boolean;
}

export const AppPageShell = ({
  children,
  contentClassName,
  fullWidth = false,
  showNavigation = true,
}: AppPageShellProps) => {
  const contentClasses = cn(
      "relative z-10 pb-24 pt-6 md:pb-12",
      fullWidth ? "w-full px-0" : "layout-shell",
    contentClassName
  );

  return (
    <ShellFrame ambient="normal">
      <div className={cn("flex min-h-[100dvh] min-w-0", fullWidth && "h-[100dvh] max-h-[100dvh] overflow-hidden")}>
        {showNavigation ? <AppNavigationRail /> : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showNavigation ? <AppGlobalHeader /> : null}
          <main className={cn("min-h-0 min-w-0 flex-1", contentClasses)}>{children}</main>
        </div>
      </div>
    </ShellFrame>
  );
};

export default AppPageShell;
