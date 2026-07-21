import { Shield } from "lucide-react";
import { UI_COPY } from "@/shared/constants/ui-copy";

export const PrivacyPolicyCards = () => {
  return (
    <div className="layout-stack mt-8 text-sm leading-7 text-muted-foreground">
      {UI_COPY.privacy.cards.map((policy) => (
        <div key={policy.title} className="surface p-4 border border-border/60">
          <p className="mb-2 font-semibold text-foreground">{policy.title}</p>
          <p>{policy.description}</p>
        </div>
      ))}

      <div className="surface p-4 border border-border/60">
        <p className="mb-2 font-semibold text-foreground inline-flex items-center gap-2">
          <Shield size={16} /> {UI_COPY.privacy.notesTitle}
        </p>
        <p>{UI_COPY.privacy.notes}</p>
      </div>
    </div>
  );
};

export default PrivacyPolicyCards;
