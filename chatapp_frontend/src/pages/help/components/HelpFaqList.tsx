import type { FC } from "react";
import { UI_COPY } from "@/shared/constants/ui-copy";

export const HelpFaqList: FC = () => {
  return (
    <div className="grid gap-3">
      {UI_COPY.help.faqs.map((item) => (
        <details
          key={item.question}
          className="surface border border-border/65 p-5 transition-all open:shadow-soft open:border-primary/50"
        >
          <summary className="cursor-pointer font-semibold leading-7">{item.question}</summary>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.answer}</p>
        </details>
      ))}
    </div>
  );
};

export default HelpFaqList;
