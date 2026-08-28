import type { FC } from "react";
import { UI_COPY } from "@/shared/constants/ui-copy";

export const HelpFaqList: FC = () => {
  return (
    <div className="divide-y divide-border border-y border-border">
      {UI_COPY.help.faqs.map((item) => (
        <details
          key={item.question}
          className="group py-5"
        >
          <summary className="focus-ring cursor-pointer list-none pr-8 font-semibold leading-7 marker:hidden group-open:text-primary">{item.question}</summary>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{item.answer}</p>
        </details>
      ))}
    </div>
  );
};

export default HelpFaqList;

