import { MessageCircle, Search, ShieldCheck, Users } from "lucide-react";
import { UI_COPY } from "@/shared/constants/ui-copy";

const icons = [Users, ShieldCheck, MessageCircle, Search];

export const HelpTipCards = () => {
  return (
    <ul className="divide-y divide-border border-y border-border" role="list">
      {UI_COPY.help.tips.map((tip, index) => {
        const Icon = icons[index % icons.length];
        return (
          <li key={tip} className="flex items-start gap-3 py-4">
            <Icon size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm leading-6 text-muted-foreground">{tip}</p>
          </li>
        );
      })}
    </ul>
  );
};

export default HelpTipCards;
