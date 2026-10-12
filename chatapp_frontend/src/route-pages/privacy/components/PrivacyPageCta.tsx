import { ArrowRight, Shield } from "lucide-react";
import Link from "next/link";
import { UI_COPY } from "@/shared/constants/ui-copy";

export const PrivacyPageCta = () => {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Link
        href="/help"
        className="focus-ring inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
      >
        <Shield size={16} aria-hidden="true" /> {UI_COPY.privacy.actions.support}
      </Link>
      <Link
        href="/settings"
        className="focus-ring inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-transform hover:-translate-y-px"
      >
        {UI_COPY.privacy.actions.settings} <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
};

export default PrivacyPageCta;
