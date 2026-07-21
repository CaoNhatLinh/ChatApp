import { Link } from "react-router-dom";
import { ThemeToggle } from "@/features/settings/ui/ThemeToggle";

const AuthShellHeader = () => {
  return (
    <header className="layout-shell absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4">
      <Link to="/" className="font-serif text-lg font-black tracking-[-0.02em]">
        NovaChat
      </Link>
      <ThemeToggle />
    </header>
  );
};

export default AuthShellHeader;

