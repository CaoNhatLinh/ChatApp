import { Link } from "react-router-dom";
import { UI_COPY } from "@/shared/constants/ui-copy";

export const HomeTopBar = () => {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      <Link
        to="/login"
        className="rounded-full border border-border/70 bg-background/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-sm"
      >
        {UI_COPY.shell.publicActions.login}
      </Link>
      <Link
        to="/register"
        className="rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-all hover:scale-[1.01]"
      >
        {UI_COPY.shell.publicActions.register}
      </Link>
    </div>
  );
};
