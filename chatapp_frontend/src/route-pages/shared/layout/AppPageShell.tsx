import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { ShellFrame } from "./ShellFrame";
import { AppShellHeader } from "./AppShellHeader";

interface AppPageShellProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  fullWidth?: boolean;
  showHeader?: boolean;
}

export const AppPageShell = ({
  title,
  actions,
  children,
  contentClassName,
  fullWidth = false,
  showHeader = true,
}: AppPageShellProps) => {
  const contentClasses = cn(
      "relative z-10 pb-12 pt-6",
      fullWidth ? "w-full px-0" : "layout-shell",
    contentClassName
  );

  return (
    <ShellFrame ambient="normal">
      {showHeader ? <AppShellHeader title={title} actions={actions} /> : null}
      <main className={contentClasses}>{children}</main>
    </ShellFrame>
  );
};

export default AppPageShell;
