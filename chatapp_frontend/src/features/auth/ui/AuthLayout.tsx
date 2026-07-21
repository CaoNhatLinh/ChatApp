import type { ReactNode } from "react";
import AuthShellHeader from "@/pages/shared/layout/AuthShellHeader";
import { ShellFrame } from "@/pages/shared/layout/ShellFrame";

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export const AuthLayout = ({ children, title, subtitle }: AuthLayoutProps) => {
  return (
    <ShellFrame ambient="normal" className="w-full flex items-center justify-center px-4 py-10">
      <AuthShellHeader />
      <div className="w-full max-w-md z-10">
        <div className="surface-elevated rounded-[1.25rem] p-8 md:p-10">
          <div className="layout-stack">
            {title ? <h2 className="text-3xl font-black tracking-[-0.02em]">{title}</h2> : null}
            {subtitle ? <p className="text-sm leading-6 text-muted-foreground max-w-prose">{subtitle}</p> : null}
          </div>

          {children}
        </div>
      </div>
    </ShellFrame>
  );
};

export default AuthLayout;
