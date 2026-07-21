import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { UI_COPY } from "@/shared/constants/ui-copy";

export const AboutIntro = () => {
  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
        {UI_COPY.about.eyebrow}
      </p>
      <h1 className="text-3xl md:text-5xl font-black tracking-[-0.025em] max-w-[14ch]">
        {UI_COPY.about.title}
      </h1>
      <p className="text-lg leading-8 text-muted-foreground">
        {UI_COPY.about.description}
      </p>
      <Link
        to="/help"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
      >
        {UI_COPY.about.cta}
        <ArrowRight size={16} />
      </Link>
    </div>
  );
};

export default AboutIntro;
