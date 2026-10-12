"use client";

import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import type { IconType } from "react-icons";
import { SiApachecassandra, SiNextdotjs, SiRadixui, SiReact, SiSpringboot, SiTailwindcss, SiTypescript } from "react-icons/si";
import { RadioTower } from "lucide-react";
import { localizeText } from "@/shared/i18n";

interface TechnologyLayer {
  name: string;
  detail: string;
  outcome: string;
  icon: LucideIcon;
  marks: Array<{
    color: string;
    icon: IconType;
    monochrome?: boolean;
  }>;
}

const technologyLayers: TechnologyLayer[] = [
  { name: "Next.js + React", detail: "Dựng từng route và nối thẳng vào luồng sử dụng thật.", outcome: "Từ trang giới thiệu, bạn đi thẳng vào ứng dụng đang chạy — không qua một bản mô phỏng.", icon: ArrowUpRight, marks: [{ icon: SiNextdotjs, color: "#000000", monochrome: true }, { icon: SiReact, color: "#61dafb" }] },
  { name: "TypeScript", detail: "Chặn dữ liệu sai trước khi nó tràn vào giao diện.", outcome: "Component biết mình nhận dữ liệu nào và phải hiện trạng thái gì.", icon: ArrowUpRight, marks: [{ icon: SiTypescript, color: "#3178c6" }] },
  { name: "Spring Boot + Cassandra", detail: "Giữ tài khoản, phòng và lịch sử sau mỗi lần tải lại.", outcome: "Cuộc trò chuyện còn nguyên khi bạn quay lại, thay vì biến mất cùng tab trình duyệt.", icon: ArrowUpRight, marks: [{ icon: SiSpringboot, color: "#6db33f" }, { icon: SiApachecassandra, color: "#1287b1" }] },
  { name: "WebSocket + STOMP", detail: "Đưa tin nhắn và trạng thái mới tới đúng phòng ngay khi chúng xảy ra.", outcome: "Tín hiệu mới xuất hiện đúng nơi, đúng lúc và không làm nhiễu phòng khác.", icon: ArrowUpRight, marks: [{ icon: RadioTower, color: "#f59e0b" }] },
  { name: "Tailwind + Radix", detail: "Giữ giao diện co giãn và dùng được bằng bàn phím.", outcome: "Control có focus và phản hồi rõ ràng, không chỉ trông đẹp khi dùng chuột.", icon: ArrowUpRight, marks: [{ icon: SiTailwindcss, color: "#06b6d4" }, { icon: SiRadixui, color: "#000000", monochrome: true }] },
];

const getBrandColorStyle = (color: string) => ({ "--tech-brand": color } as CSSProperties);

export const TechnologyRelay = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const activeLayer = technologyLayers[activeIndex];
  const Icon = activeLayer.icon;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? technologyLayers.length - 1 : (index + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1) + technologyLayers.length) % technologyLayers.length;
    setActiveIndex(nextIndex);
    document.getElementById(`tech-layer-${nextIndex}`)?.focus();
  };

  return (
    <section className="tech-relay" aria-labelledby="technology-title">
      <div className="layout-shell py-24 sm:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.42fr_0.58fr] lg:items-end">
          <div>
            <p className="relay-kicker text-primary">{localizeText("Công nghệ bên dưới Nối")}</p>
            <h2 id="technology-title">{localizeText("Một app chat, nhiều lớp phải ăn khớp.")}</h2>
          </div>
          <p className="tech-relay-intro">{localizeText("Chạm vào từng lớp. Bên phải là phần việc bạn thực sự nhận được.")}</p>
        </div>

        <div className="tech-console">
          <div className="tech-layer-list" aria-label={localizeText("Các lớp công nghệ của Nối")}>
            {technologyLayers.map((layer, index) => {
              const isActive = activeIndex === index;
              return (
                <button key={layer.name} id={`tech-layer-${index}`} type="button" className="tech-layer-button focus-ring" aria-pressed={isActive} data-active={isActive || undefined} onClick={() => setActiveIndex(index)} onKeyDown={(event) => handleKeyDown(event, index)}>
                  <span className="tech-layer-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="tech-layer-marks" aria-hidden="true">
                    {layer.marks.map(({ color, icon: Mark, monochrome }, markIndex) => <Mark key={markIndex} className="tech-brand-mark" data-monochrome={monochrome || undefined} style={getBrandColorStyle(color)} />)}
                  </span>
                  <span className="tech-layer-name"><strong>{layer.name}</strong><small>{localizeText(layer.detail)}</small></span>
                  <ArrowUpRight className="tech-layer-arrow" size={18} aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <div className="tech-inspector" aria-live="polite">
            <div className="tech-inspector-orbit" aria-hidden="true"><span /><span /><span data-index={activeIndex} /></div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={activeLayer.name} className="tech-inspector-copy" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -7 }} transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}>
                <div className="tech-inspector-marks" aria-hidden="true">{activeLayer.marks.map(({ color, icon: Mark, monochrome }, markIndex) => <Mark key={markIndex} className="tech-brand-mark" data-monochrome={monochrome || undefined} style={getBrandColorStyle(color)} />)}</div>
                <p className="tech-inspector-label">{localizeText("Đang xem")}</p>
                <h3>{activeLayer.name}</h3>
                <p>{localizeText(activeLayer.detail)}</p>
                <p className="tech-inspector-outcome">{localizeText(activeLayer.outcome)}</p>
                <Icon className="tech-inspector-arrow" size={18} aria-hidden="true" />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TechnologyRelay;
