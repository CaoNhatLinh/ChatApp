import { Lock, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { UI_COPY } from "@/shared/constants/ui-copy";

export const PrivacyPageCta = () => {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Link
        to="/help"
        className="inline-flex items-center gap-2 rounded-xl border border-border/70 px-4 py-2.5 text-sm font-semibold hover:bg-card"
      >
        <Shield size={16} /> {UI_COPY.privacy.actions.support}
      </Link>
      <Link
        to="/help"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        <Lock size={16} /> {UI_COPY.privacy.actions.guide}
      </Link>
    </div>
  );
};

export default PrivacyPageCta;
