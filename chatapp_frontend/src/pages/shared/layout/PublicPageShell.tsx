import type { ReactNode } from "react";
import { ShellFrame } from "./ShellFrame";
import PublicShellHeader from "./PublicShellHeader";

interface PublicPageShellProps {
  title?: string;
  topClassName?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export const PublicPageShell = ({
  title = "NovaChat",
  topClassName,
  actions,
  children,
}: PublicPageShellProps) => {
  return (
    <ShellFrame ambient="strong">
      <PublicShellHeader title={title} topClassName={topClassName} actions={actions} />
      <main className="layout-shell relative z-10 pb-16 pt-2">{children}</main>
    </ShellFrame>
  );
};

export default PublicPageShell;
