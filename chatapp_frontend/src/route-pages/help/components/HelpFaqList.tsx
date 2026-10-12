import type { FC } from "react";
import { UI_COPY } from "@/shared/constants/ui-copy";

export const HelpFaqList: FC = () => {
  return (
    <div className="help-faq-list">
      {UI_COPY.help.faqs.map((item, index) => (
        <details
          key={item.question}
          className="help-faq group"
        >
          <summary className="focus-ring cursor-pointer list-none marker:hidden">
            <span className="help-faq-index">{String(index + 1).padStart(2, "0")}</span>
            <span className="help-faq-question">{item.question}</span>
            <span className="help-faq-toggle" aria-hidden="true" />
          </summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
};

export default HelpFaqList;

