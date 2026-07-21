import { Shield, Sparkles, Users } from "lucide-react";
import { UI_COPY } from "@/shared/constants/ui-copy";

export const AboutValueCards = () => {
  return (
    <div className="flex-1 lg:block">
      <div className="grid gap-3">
        {UI_COPY.about.values.map((value) => {
          const Icon = value.title === UI_COPY.about.values[0].title
            ? Shield
            : value.title === UI_COPY.about.values[1].title
              ? Users
              : Sparkles;
          return (
            <div
              key={value.title}
              className="surface p-5 border border-border/65 transition hover:-translate-y-1 hover:shadow-soft"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-background">
                <Icon size={18} className="text-primary" />
              </div>
              <h3 className="mb-1 font-semibold">{value.title}</h3>
              <p className="text-sm text-muted-foreground leading-6">{value.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AboutValueCards;
