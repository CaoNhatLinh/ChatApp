import { MessageCircle, Search, ShieldCheck, Users } from "lucide-react";
import { UI_COPY } from "@/shared/constants/ui-copy";

const icons = [Users, ShieldCheck, MessageCircle, Search];

export const HelpTipCards = () => {
  return (
    <div className="surface p-5 border border-border/65 layout-grid-auto">
      {UI_COPY.help.tips.map((tip, index) => {
        const Icon = icons[index % icons.length];
        return (
          <div key={tip} className="flex items-start gap-3">
            <div className="rounded-lg border border-border/70 bg-background p-2">
              <Icon size={18} className="text-primary" />
            </div>
            <p className="text-sm leading-7 text-muted-foreground">{tip}</p>
          </div>
        );
      })}
    </div>
  );
};

export default HelpTipCards;
