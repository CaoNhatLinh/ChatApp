import { ArrowUpRight, LockKeyhole, MessageCircle, Users } from "lucide-react";
import Link from "next/link";
import { PublicPageShell } from "@/route-pages/shared/PublicPageShell";
import { localizeText } from "@/shared/i18n";

const benefits = [
  {
    title: "Cuộc trò chuyện rõ ràng",
    body: "Tin nhắn, tệp và trạng thái nằm trong cùng một luồng dễ theo dõi.",
    icon: MessageCircle,
  },
  {
    title: "Kết nối có chủ đích",
    body: "Chỉ bắt đầu cuộc trò chuyện sau khi hai bên xác nhận kết nối.",
    icon: Users,
  },
  {
    title: "Riêng tư theo mặc định",
    body: "Phiên đăng nhập, quyền truy cập và lịch sử được kiểm soát rõ ràng.",
    icon: LockKeyhole,
  },
] as const;

export const HomePage = () => {
  return (
    <PublicPageShell>
      <section className="public-stage">
        <div className="layout-shell grid min-h-[calc(100dvh-4.1rem)] items-center gap-10 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-16">
          <div className="page-intro">
            <p className="page-kicker">{localizeText("Trò chuyện realtime, không rối")}</p>
            <h1 className="max-w-[10ch] text-5xl font-bold leading-[0.98] tracking-[-0.045em] text-balance sm:text-6xl">
              {localizeText("Nói điều cần nói. Giữ lại điều quan trọng.")}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              {localizeText("NovaChat giúp bạn chuyển từ lời mời đến cuộc hội thoại trong vài thao tác rõ ràng.")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="focus-ring inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px">
                {localizeText("Tạo tài khoản")}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/login" className="focus-ring inline-flex items-center rounded-[var(--radius-md)] border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:border-primary hover:text-primary">
                {localizeText("Đăng nhập")}
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">{localizeText("Không có thư rác mời gọi. Không có bảng điều khiển thừa.")}</p>
          </div>

          <div className="relative">
            <figure className="neo-shadow overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
              <img src="/novachat-hero.png" alt={localizeText("Các cửa sổ hội thoại giao nhau trong một luồng tín hiệu màu cam")} className="h-auto w-full object-cover" width="1600" height="1000" fetchPriority="high" />
              <figcaption className="flex items-center justify-between gap-4 border-t border-border px-4 py-3 text-xs text-muted-foreground">
                <span>{localizeText("Không gian hội thoại tập trung")}</span>
                <span className="font-semibold text-foreground">NovaChat</span>
              </figcaption>
            </figure>
            <div className="neo-shadow-sm absolute -bottom-5 left-5 max-w-[220px] rounded-[var(--radius-md)] border border-border bg-card px-4 py-3 sm:left-8">
              <p className="text-sm font-semibold">{localizeText("Một luồng. Mọi tín hiệu.")}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{localizeText("Trạng thái trực tuyến, đã đọc và tệp đính kèm cùng xuất hiện đúng chỗ.")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-frame">
        <div className="layout-shell">
          <div className="page-intro">
            <h2 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">{localizeText("Thiết kế để bạn không phải tìm đường.")}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{localizeText("Từ kết nối đầu tiên đến từng tin nhắn, các trạng thái và hành động đều được đặt ở nơi bạn mong đợi.")}</p>
          </div>
          <div className="mt-10 grid gap-0 border-y border-border lg:grid-cols-3">
            {benefits.map(({ title, body, icon: Icon }, index) => (
              <article key={title} className="border-b border-border py-6 lg:border-b-0 lg:border-r lg:px-7 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0">
                <div className="flex items-center gap-3">
                  <span className="brand-mark h-8 w-8 rounded-[0.6rem] text-xs"><Icon size={16} aria-hidden="true" /></span>
                  <span className="text-xs font-semibold text-muted-foreground">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{localizeText(title)}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{localizeText(body)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-frame">
        <div className="layout-shell flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="page-intro">
            <h2 className="text-3xl font-bold tracking-[-0.03em]">{localizeText("Bắt đầu từ một cuộc trò chuyện.")}</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">{localizeText("Tạo tài khoản miễn phí hoặc xem cách NovaChat bảo vệ dữ liệu của bạn.")}</p>
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
