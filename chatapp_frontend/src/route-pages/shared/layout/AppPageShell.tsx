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
}

export const AppPageShell = ({
  title,
  actions,
  children,
  contentClassName,
  fullWidth = false,
}: AppPageShellProps) => {
  const contentClasses = cn(
      "relative z-10 pb-12 pt-6",
      fullWidth ? "w-full px-0" : "layout-shell",
    contentClassName
  );

  return (
    <ShellFrame ambient="normal">
      <AppShellHeader title={title} actions={actions} />
      <main className={contentClasses}>{children}</main>
    </ShellFrame>
  );
};

export default AppPageShell;
