"use client";

import { MessageCircle, Search, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { localizeText } from "@/shared/i18n";

const icons = [Users, ShieldCheck, MessageCircle, Search];

export const HelpTipCards = () => {
  const [activeTip, setActiveTip] = useState(0);
  return (
    <ul className="help-tip-orbit" role="list">
      {UI_COPY.help.tips.map((tip, index) => {
        const Icon = icons[index % icons.length];
        return (
          <li key={tip} className={`help-tip help-tip-${index + 1}`} data-active={activeTip === index || undefined}>
            <button type="button" className="help-tip-control focus-ring" aria-pressed={activeTip === index} onClick={() => setActiveTip(index)}>
              <span><Icon size={18} aria-hidden="true" /></span>
              <p>{tip}</p>
              <small>{localizeText("Chọn để đánh dấu")}</small>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default HelpTipCards;
