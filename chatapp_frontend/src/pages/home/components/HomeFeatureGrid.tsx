import { MessageCircle, ShieldCheck, Sparkles, Users } from "lucide-react";
import { UI_COPY } from "@/shared/constants/ui-copy";

const featureCards = [
  {
    icon: MessageCircle,
    title: UI_COPY.homeCards.realtime.title,
    description: UI_COPY.homeCards.realtime.description,
  },
  {
    icon: Users,
    title: UI_COPY.homeCards.friends.title,
    description: UI_COPY.homeCards.friends.description,
  },
  {
    icon: ShieldCheck,
    title: UI_COPY.homeCards.stable.title,
    description: UI_COPY.homeCards.stable.description,
  },
  {
    icon: Sparkles,
    title: UI_COPY.homeCards.responsive.title,
    description: UI_COPY.homeCards.responsive.description,
  },
];

export const HomeFeatureGrid = () => {
  return (
    <div className="layout-grid-feature mt-2">
      {featureCards.map((feature) => {
        const Icon = feature.icon;
        return (
          <article
            key={feature.title}
            className="surface border border-border/60 p-5 transition hover:-translate-y-1 hover:shadow-soft"
          >
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 bg-background">
              <Icon size={22} className="text-primary" />
            </div>
            <h2 className="mb-2 text-lg font-semibold">{feature.title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{feature.description}</p>
          </article>
        );
      })}
    </div>
  );
};

export default HomeFeatureGrid;
