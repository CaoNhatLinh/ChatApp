"use client";

import { Check, Database, LockKeyhole, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { localizeText } from "@/shared/i18n";

const cardIcons = [Database, SlidersHorizontal, LockKeyhole] as const;

export const PrivacyPolicyCards = () => {
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const activeCard = UI_COPY.privacy.cards[activeCardIndex];
  const ActiveIcon = cardIcons[activeCardIndex];

  return (
    <div className="min-w-0">
      <div className="divide-y divide-border border-y border-border">
        {UI_COPY.privacy.lifecycle.map((item) => (
          <article key={item.title} className="grid gap-3 py-6 sm:grid-cols-[2.5rem_0.72fr_1.28fr] sm:items-start sm:gap-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/12 text-primary"><Check size={16} aria-hidden="true" /></span>
            <h3 className="text-base font-semibold tracking-[-0.02em]">{item.title}</h3>
            <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
          </article>
        ))}
      </div>
      <div className="privacy-control-deck mt-8">
        <div className="privacy-control-list" role="group" aria-label={localizeText("Chọn phần quyền riêng tư cần xem") }>
        {UI_COPY.privacy.cards.map((card, index) => {
          const Icon = cardIcons[index];
          return <button key={card.title} type="button" className="privacy-control focus-ring" data-active={activeCardIndex === index || undefined} aria-pressed={activeCardIndex === index} onClick={() => setActiveCardIndex(index)}><Icon size={18} aria-hidden="true" /><span>{card.title}</span><small>0{index + 1}</small></button>;
        })}
        </div>
        <div className="privacy-control-inspector" aria-live="polite">
          <ActiveIcon size={26} aria-hidden="true" />
          <p>{localizeText("Đang xem")}</p>
          <h3>{activeCard.title}</h3>
          <div key={activeCard.title}>{activeCard.description}</div>
        </div>
      </div>
      <aside className="mt-8 border-l-2 border-primary/45 pl-4"><p className="text-sm font-semibold">{UI_COPY.privacy.notesTitle}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{UI_COPY.privacy.notes}</p><ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">{UI_COPY.privacy.controls.map((control) => <li key={control} className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{control}</li>)}</ul></aside>
    </div>
  );
};

export default PrivacyPolicyCards;
