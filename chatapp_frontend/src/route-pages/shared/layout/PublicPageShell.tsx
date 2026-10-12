import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShellFrame } from "./ShellFrame";
import PublicShellHeader from "./PublicShellHeader";
import { localizeText } from '@/shared/i18n';
import { BrandWord } from '@/shared/ui/BrandWord';

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
      <footer className="public-footer relative z-10">
        <div className="layout-shell grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.72fr_0.55fr] lg:gap-8">
          <section className="max-w-sm">
            <span className="inline-flex text-foreground"><BrandWord /></span>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{localizeText("Một project cá nhân để học cách xây một app chat có thể dùng thật.")}</p>
          </section>

          <section>
            <p className="public-footer-label">{localizeText("Tìm hiểu thêm")}</p>
            <nav aria-label={localizeText("Liên kết pháp lý")} className="mt-4 grid gap-2 text-sm">
              <Link className="focus-ring public-footer-link" href="/privacy">{localizeText("Quyền riêng tư")}</Link>
              <Link className="focus-ring public-footer-link" href="/terms">{localizeText("Điều khoản")}</Link>
              <Link className="focus-ring public-footer-link" href="/help">{localizeText("Trợ giúp")}</Link>
            </nav>
          </section>

          <a href="https://github.com/CaoNhatLinh" target="_blank" rel="noreferrer" aria-label={localizeText("Mở GitHub của Cao Nhật Linh")} className="focus-ring public-footer-kamling">
            <span>{localizeText("Được làm bởi")}</span>
            <Image src="/kamling-logo.png" alt="Kamling" width={190} height={95} sizes="190px" className="h-auto w-36 object-contain sm:w-40" />
            <span className="public-footer-github">github.com/CaoNhatLinh <span aria-hidden="true">↗</span></span>
          </a>
        </div>
      </footer>
    </ShellFrame>
  );
};

export default PublicPageShell;
