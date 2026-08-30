import type { ReactNode } from "react";
import Link from "next/link";
import { ShellFrame } from "./ShellFrame";
import PublicShellHeader from "./PublicShellHeader";
import { localizeText } from '@/shared/i18n';

interface PublicPageShellProps {
  title?: string;
  topClassName?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export const PublicPageShell = ({
  title = "Nối",
  topClassName,
  actions,
  children,
}: PublicPageShellProps) => {
  return (
    <ShellFrame ambient="strong">
      <PublicShellHeader title={title} topClassName={topClassName} actions={actions} />
      <main className="relative z-10 pb-16 pt-2">{children}</main>
      <footer className="relative z-10 border-t border-border/70">
        <div className="layout-shell flex flex-col gap-3 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-foreground">Nối</span>
          <nav aria-label={localizeText("Liên kết pháp lý")} className="flex flex-wrap gap-4">
            <Link className="focus-ring hover:text-foreground" href="/privacy">{localizeText("Quyền riêng tư")}</Link>
            <Link className="focus-ring hover:text-foreground" href="/terms">{localizeText("Điều khoản")}</Link>
            <Link className="focus-ring hover:text-foreground" href="/help">{localizeText("Trợ giúp")}</Link>
          </nav>
        </div>
      </footer>
    </ShellFrame>
  );
};

export default PublicPageShell;
