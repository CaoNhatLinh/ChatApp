"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, DoorOpen, MessageCircleMore, UsersRound } from "lucide-react";
import { useState } from "react";
import { localizeText } from "@/shared/i18n";

const signals = [
  {
    index: "01",
    title: "Tin nhắn đến đúng lúc",
    body: "Tin nhắn và trạng thái xuất hiện ngay trong căn phòng của chúng.",
    note: "Một thay đổi nhỏ được chuyển tới đúng cuộc trò chuyện, không làm nhiễu phần còn lại.",
    icon: MessageCircleMore,
    tone: "cyan",
  },
  {
    index: "02",
    title: "Mỗi nhóm có một không gian",
    body: "Bạn bè, nhóm học và cộng đồng không chen vào cùng một mạch.",
    note: "Mỗi phòng giữ người, tin nhắn và trạng thái của riêng nó — mở lại vẫn tiếp đúng nhịp.",
    icon: UsersRound,
    tone: "violet",
  },
  {
    index: "03",
    title: "Quyền truy cập nhìn thấy được",
    body: "Lời mời, vai trò và giới hạn luôn có ngữ cảnh rõ ràng.",
    note: "Điều bạn được làm hiện ra ngay tại nơi hành động xảy ra, không giấu trong một màn hình xa lạ.",
    icon: DoorOpen,
    tone: "green",
  },
] as const;

export const SignalSequence = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const activeSignal = signals[activeIndex];
  const ActiveIcon = activeSignal.icon;

  return (
    <div className="signal-console">
      <div className="signal-console-list" role="group" aria-label={localizeText("Chọn một tín hiệu để xem cách Nối phản hồi")}>
        {signals.map((signal, index) => {
          const Icon = signal.icon;
          const isActive = activeIndex === index;

          return (
            <button
              key={signal.index}
              type="button"
              className="signal-console-control focus-ring"
              data-active={isActive || undefined}
              data-tone={signal.tone}
              aria-pressed={isActive}
              onClick={() => setActiveIndex(index)}
            >
              <span className="signal-console-index">{signal.index}</span>
              <span className="signal-console-icon"><Icon size={18} aria-hidden="true" /></span>
              <span className="signal-console-copy"><strong>{localizeText(signal.title)}</strong><small>{localizeText(signal.body)}</small></span>
              <ArrowUpRight className="signal-console-arrow" size={18} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="signal-receiver" data-tone={activeSignal.tone} aria-live="polite">
        <div className="signal-receiver-field" aria-hidden="true">
          <i /><i /><i />
          <span className="signal-receiver-pulse"><ActiveIcon size={22} /></span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeSignal.index}
            className="signal-receiver-copy"
            initial={reduceMotion ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8, filter: "blur(3px)" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <p>{localizeText("Đang theo tín hiệu")} / {activeSignal.index}</p>
            <h3>{localizeText(activeSignal.title)}</h3>
            <span>{localizeText(activeSignal.note)}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SignalSequence;
