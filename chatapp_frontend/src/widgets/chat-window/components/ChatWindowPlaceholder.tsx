import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, UsersRound } from "lucide-react";
import { UI_MOTION_VARIANTS, UI_MOTION_CONFIG } from "@/shared/constants/ui-motion-variants";
import type { FC } from 'react';
import { localizeText } from '@/shared/i18n';
import { BrandText } from '@/shared/ui/BrandWord';

interface ChatWindowPlaceholderProps {
  title: string;
  message: string;
}

export const ChatWindowPlaceholder: FC<ChatWindowPlaceholderProps> = ({ title, message }) => {
  return (
    <motion.div
      className="signal-empty-stage flex-1 h-full flex flex-col items-center justify-center p-4 sm:p-8"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.fadeIn}
    >
      <div className="signal-empty-orbit" aria-hidden="true"><i /><i /><i /></div>
      <div className="signal-empty-content">
        <motion.div
          className="signal-empty-art"
          initial={UI_MOTION_CONFIG.initialState}
          animate={UI_MOTION_CONFIG.animateState}
          variants={UI_MOTION_VARIANTS.loadingFloat}
        >
          <Image src="/noi-signal-orbit.svg" alt="" aria-hidden="true" width={240} height={150} className="h-full w-full object-cover" />
        </motion.div>
        <div className="signal-empty-copy">
          <p>{localizeText('Chưa có tín hiệu nào được chọn')}</p>
          <h3>{title}</h3>
          <p><BrandText text={message} /></p>
          <div className="signal-empty-actions">
            <Link href="/communities" className="focus-ring"><span>{localizeText('Tìm một cộng đồng')}</span><ArrowUpRight size={16} aria-hidden="true" /></Link>
            <Link href="/friends" className="focus-ring"><UsersRound size={16} aria-hidden="true" /><span>{localizeText('Mở danh sách bạn bè')}</span></Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
