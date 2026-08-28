import type { ReactNode } from "react";
import AuthShellHeader from "@/route-pages/shared/layout/AuthShellHeader";
import { ShellFrame } from "@/route-pages/shared/layout/ShellFrame";

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export const AuthLayout = ({ children, title, subtitle }: AuthLayoutProps) => {
  return (
    <ShellFrame ambient="normal" className="w-full flex items-center justify-center px-4 py-12">
      <AuthShellHeader />
      <div className="w-full max-w-md z-10">
        <div className="product-surface p-7 md:p-9">
          <div className="layout-stack">
            {title ? <h1 className="text-3xl font-bold tracking-[-0.03em]">{title}</h1> : null}
            {subtitle ? <p className="text-sm leading-6 text-muted-foreground max-w-prose">{subtitle}</p> : null}
          </div>

          {children}
        </div>
      </div>
    </ShellFrame>
  );
};

export default AuthLayout;
