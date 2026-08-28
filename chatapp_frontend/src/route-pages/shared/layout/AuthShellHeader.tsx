import Link from "next/link";
import { ThemeToggle } from "@/features/settings/ui/ThemeToggle";
import { BrandLockup } from "@/shared/ui/Brand";
import { LanguageToggle } from "@/shared/ui/LanguageToggle";

const AuthShellHeader = () => {
  return (
    <header className="layout-shell absolute inset-x-0 top-0 z-20 flex items-center justify-between py-4">
      <Link href="/" className="focus-ring flex items-center gap-2 text-base font-bold tracking-[-0.02em]">
        <BrandLockup />
      </Link>
      <div className="flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
};

export default AuthShellHeader;
