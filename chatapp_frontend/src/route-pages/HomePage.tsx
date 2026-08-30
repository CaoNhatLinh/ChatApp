"use client";

import Image from "next/image";
import { ArrowUpRight, LockKeyhole, MessageCircle, Users } from "lucide-react";
import Link from "next/link";
import { PublicPageShell } from "@/route-pages/shared/PublicPageShell";
import { localizeText, useAppLocale } from "@/shared/i18n";

const promises = [
  {
    title: "Giữ đúng ngữ cảnh",
    body: "Tin nhắn, tệp và trạng thái ở cùng một luồng để cuộc trò chuyện không bị đứt đoạn.",
    icon: MessageCircle,
  },
  {
    title: "Kết nối có ý thức",
    body: "Bạn quyết định khi nào bắt đầu kết nối và ai có thể bước vào cuộc trò chuyện.",
    icon: Users,
  },
  {
    title: "Riêng tư theo mặc định",
    body: "Phiên, quyền truy cập và lịch sử có ranh giới rõ ràng ngay từ đầu.",
    icon: LockKeyhole,
  },
] as const;

export const HomePage = () => {
  const { locale } = useAppLocale();

  return (
    <PublicPageShell>
      <section className="landing-hero" lang={locale}>
        <div className="layout-shell grid min-h-[calc(100dvh-4.1rem)] items-center gap-9 py-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-14 lg:py-12">
          <div className="relative z-10 py-8 lg:py-0">
            <p className="page-kicker">{localizeText("Tín hiệu gặp nhau")}</p>
            <h1 className="max-w-[9ch] text-5xl font-bold leading-[0.94] tracking-[-0.06em] text-balance sm:text-6xl lg:text-7xl">
              {localizeText("Trò chuyện bắt đầu khi hai người sẵn sàng.")}
            </h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              {localizeText("Nối giữ cuộc trò chuyện, trạng thái và những điều quan trọng trong một nhịp rõ ràng.")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="focus-ring inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px">
                {localizeText("Bắt đầu một cuộc trò chuyện")}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/about" className="focus-ring inline-flex items-center rounded-[var(--radius-md)] border border-border bg-background/80 px-5 py-3 text-sm font-semibold transition-colors hover:border-primary hover:text-primary">
                {localizeText("Vì sao Nối")}
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">{localizeText("Không bảng điều khiển thừa. Không làm bạn lạc khỏi cuộc trò chuyện.")}</p>
          </div>

          <div className="landing-hero-art relative overflow-hidden rounded-[1.35rem] border border-border/80 bg-[#121d2a]">
            <figure className="relative aspect-[16/10]">
              <Image src="/noi-relay-hero.png" alt={localizeText("Hai dải tín hiệu cam giao nhau trong không gian Nối")} fill priority sizes="(max-width: 1024px) 100vw, 58vw" className="object-cover" />
            </figure>
            <div className="absolute bottom-4 left-4 rounded-full border border-white/20 bg-[#121d2a]/85 px-3 py-1.5 text-xs font-medium tracking-[0.08em] text-[#f6eee3] backdrop-blur sm:bottom-6 sm:left-6">
              {localizeText("NỐI / NHỊP 01")}
            </div>
          </div>
        </div>
      </section>

      <section className="section-frame border-t-0 pt-10 sm:pt-14">
        <div className="layout-shell grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div className="page-intro">
            <p className="page-kicker">{localizeText("Một nhịp rõ ràng")}</p>
            <h2 className="text-3xl font-bold tracking-[-0.045em] sm:text-4xl">{localizeText("Ít giao diện hơn. Nhiều cuộc trò chuyện hơn.")}</h2>
          </div>
          <div className="border-t border-border">
            {promises.map(({ title, body, icon: Icon }) => (
              <article key={title} className="grid gap-3 border-b border-border py-6 sm:grid-cols-[2.75rem_0.76fr_1.24fr] sm:items-start sm:gap-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/12 text-primary"><Icon size={16} aria-hidden="true" /></span>
                <h3 className="text-lg font-semibold tracking-[-0.02em]">{localizeText(title)}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{localizeText(body)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-frame">
        <div className="layout-shell flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="page-intro">
            <h2 className="text-3xl font-bold tracking-[-0.045em]">{localizeText("Nói điều cần nói. Giữ lại điều quan trọng.")}</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">{localizeText("Bắt đầu bằng lời mời, đi tiếp bằng một không gian trò chuyện có chủ đích.")}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link href="/help" className="focus-ring inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary">{localizeText("Xem hướng dẫn")} <ArrowUpRight size={16} aria-hidden="true" /></Link>
            <Link href="/privacy" className="focus-ring inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-transform hover:-translate-y-px">{localizeText("Đọc về riêng tư")}</Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
};

export default HomePage;
