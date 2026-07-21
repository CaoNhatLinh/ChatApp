import { ChevronRight, Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import HomeFeatureGrid from "@/pages/home/components/HomeFeatureGrid";
import HomeQuickLinks from "@/pages/home/components/HomeQuickLinks";
import { UI_COPY } from "@/shared/constants/ui-copy";

const BRAND_NAME = "NovaChat";

const HOME_BASE_IMAGE_URL =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260609_195923_b0ba8ace-1d1d-4f2c-9a28-1ab84b330680.png&w=1280&q=85";
const HOME_REVEAL_IMAGE_URL =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260609_201152_bba90a12-bf12-459f-91f0-51f237dbaf3b.png&w=1280&q=85";
const SPOTLIGHT_R = 260;

const NAV_LINKS = [
  { label: "Tính năng", href: "#feature-highlights" },
  { label: "Mở nhanh", href: "#quick-links" },
  { label: "App", href: "/app" },
  { label: "Bạn bè", href: "/friends" },
  { label: "Hỗ trợ", href: "/help" },
] as const;

interface RevealLayerProps {
  image: string;
  cursorX: number;
  cursorY: number;
  reducedMotion: boolean;
}

const RevealLayer = ({ image, cursorX, cursorY, reducedMotion }: RevealLayerProps) => {
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawMask = useCallback(() => {
    const layer = layerRef.current;
    const canvas = canvasRef.current;

    if (!layer || !canvas) return;

    const context = canvas.getContext("2d", { willReadFrequently: false });
    if (!context) return;

    if (reducedMotion) {
      layer.style.removeProperty("mask-image");
      layer.style.removeProperty("-webkit-mask-image");
      layer.style.opacity = "1";
      return;
    }

    layer.style.opacity = "1";
    context.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = context.createRadialGradient(
      cursorX,
      cursorY,
      0,
      cursorX,
      cursorY,
      SPOTLIGHT_R
    );
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.4, "rgba(255,255,255,1)");
    gradient.addColorStop(0.6, "rgba(255,255,255,0.75)");
    gradient.addColorStop(0.75, "rgba(255,255,255,0.4)");
    gradient.addColorStop(0.88, "rgba(255,255,255,0.12)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(cursorX, cursorY, SPOTLIGHT_R, 0, Math.PI * 2);
    context.fill();

    const mask = canvas.toDataURL();
    layer.style.maskImage = `url("${mask}")`;
    layer.style.webkitMaskImage = `url("${mask}")`;
    layer.style.maskSize = "100% 100%";
    layer.style.webkitMaskSize = "100% 100%";
    layer.style.maskRepeat = "no-repeat";
    layer.style.webkitMaskRepeat = "no-repeat";
  }, [cursorX, cursorY, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = layerRef.current;
    if (!canvas || !layer) return;

    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawMask();
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [drawMask]);

  useEffect(() => {
    drawMask();
  }, [drawMask]);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30 bg-center bg-cover bg-no-repeat hero-layer hero-reveal-layer"
      style={{ backgroundImage: `url(${image})` }}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 hidden"
        aria-hidden="true"
      />
    </div>
  );
};

const Logo = () => {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/10">
        <span className="font-bold text-sm tracking-wide text-white" aria-hidden="true">
          NC
        </span>
      </span>
      <span className="text-white text-2xl font-playfair italic tracking-tight">{BRAND_NAME}</span>
    </div>
  );
};

const navigateAnchor = (
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
  closeMobile?: () => void
) => {
  if (!href.startsWith("#")) return;

  event.preventDefault();
  const id = href.slice(1);
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  closeMobile?.();
};

export const HomePage = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const rawMouse = useRef({ x: -999, y: -999 });
  const smoothMouse = useRef({ x: -999, y: -999 });
  const frameRef = useRef<number>(0);
  const [cursorPos, setCursorPos] = useState({ x: -999, y: -999 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const animateCursor = useCallback(() => {
    if (reducedMotion) {
      setCursorPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      frameRef.current = requestAnimationFrame(animateCursor);
      return;
    }

    smoothMouse.current.x += (rawMouse.current.x - smoothMouse.current.x) * 0.1;
    smoothMouse.current.y += (rawMouse.current.y - smoothMouse.current.y) * 0.1;
    setCursorPos((prev) => {
      if (prev.x === smoothMouse.current.x && prev.y === smoothMouse.current.y) {
        return prev;
      }
      return { x: smoothMouse.current.x, y: smoothMouse.current.y };
    });
    frameRef.current = requestAnimationFrame(animateCursor);
  }, [reducedMotion]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    if (typeof window !== "undefined") {
      rawMouse.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      smoothMouse.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    const handleMouseMove = (event: MouseEvent) => {
      rawMouse.current = { x: event.clientX, y: event.clientY };
    };

    const handleMouseLeave = () => {
      rawMouse.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    };

    section.addEventListener("mousemove", handleMouseMove);
    section.addEventListener("mouseleave", handleMouseLeave);
    frameRef.current = requestAnimationFrame(animateCursor);

    return () => {
      section.removeEventListener("mousemove", handleMouseMove);
      section.removeEventListener("mouseleave", handleMouseLeave);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [animateCursor]);

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <>
      <section
        ref={sectionRef}
        className="relative w-full min-h-screen overflow-hidden bg-black tracking-[-0.02em]"
      >
        <nav className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between p-4 sm:p-5">
          <Logo />

          <div
            aria-hidden="true"
            className="hidden md:flex absolute left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md border border-white/30 rounded-full px-2 py-2 items-center gap-1"
          >
            {NAV_LINKS.map((item, index) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(event) => navigateAnchor(event, item.href, undefined)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  index === 0 ? "bg-white text-gray-900" : "text-white/80 hover:bg-white/20 hover:text-white"
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>

          <a
            href="/app"
            className="hidden md:inline-flex text-sm font-semibold bg-white text-gray-900 px-6 py-2.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            {UI_COPY.shell.publicActions.chat}
          </a>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>

        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-x-0 top-16 z-[98] px-4">
            <div className="rounded-2xl border border-white/20 bg-black/85 backdrop-blur-xl p-3 flex flex-col gap-2">
              {NAV_LINKS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(event) => navigateAnchor(event, item.href, () => setMobileMenuOpen(false))}
                  className="px-4 py-2 rounded-xl text-sm text-white/90 hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        )}

        <div
          className="absolute inset-0 z-10 bg-center bg-cover bg-no-repeat hero-zoom"
          style={{ backgroundImage: `url(${HOME_BASE_IMAGE_URL})` }}
        />

        <RevealLayer
          image={HOME_REVEAL_IMAGE_URL}
          cursorX={cursorPos.x}
          cursorY={cursorPos.y}
          reducedMotion={reducedMotion}
        />

        <div className="absolute top-[14%] left-0 right-0 flex flex-col items-center text-center px-5 pointer-events-none z-50">
          <h1 className="text-white leading-[0.95]">
            <span
              className="block hero-anim hero-reveal font-playfair italic font-normal text-5xl sm:text-7xl md:text-8xl"
              style={{ letterSpacing: "-0.05em", animationDelay: "0.25s" }}
            >
              {UI_COPY.home.heroTitle.split(",")[0] || "Chat nhanh"}
            </span>
            <span
              className="block hero-anim hero-reveal font-normal text-5xl sm:text-7xl md:text-8xl -mt-1"
              style={{ letterSpacing: "-0.08em", animationDelay: "0.42s" }}
            >
              {BRAND_NAME}
            </span>
          </h1>
        </div>

        <div className="hidden sm:block absolute bottom-14 left-10 md:left-14 max-w-[260px] z-50 hero-anim hero-fade" style={{ animationDelay: "0.7s" }}>
          <p className="text-sm text-white/80 leading-relaxed">
            {UI_COPY.home.heroDesc}
          </p>
        </div>

        <div className="absolute bottom-10 sm:bottom-24 left-5 right-5 sm:left-auto sm:right-10 md:right-14 max-w-full sm:max-w-[300px] z-50 flex flex-col items-start gap-4 sm:gap-5">
          <p className="hero-anim hero-fade text-xs sm:text-sm text-white/80 leading-relaxed" style={{ animationDelay: "0.85s" }}>
            {String(UI_COPY.home.featureTitle.chat)} {`•`} {String(UI_COPY.home.featureTitle.friends)} • {String(UI_COPY.home.featureTitle.responsive)}
          </p>
          <a
            href="/app"
            className="hero-anim hero-fade bg-[#e8702a] hover:bg-[#d2611f] text-white text-sm font-medium px-7 py-3 rounded-full transition-all hover:scale-[1.03] active:scale-95 hover:shadow-lg hover:shadow-[#e8702a]/30"
            style={{ animationDelay: "0.85s" }}
          >
            {UI_COPY.home.ctaSecondary}
          </a>
        </div>

        <a
          href="/search"
          aria-label="Mở tìm nhanh"
          className="fixed right-4 top-4 z-[101] inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white opacity-70 hover:opacity-100 md:hidden"
        >
          <ChevronRight size={18} />
        </a>
      </section>

      <main id="feature-highlights" className="relative z-20 bg-background text-foreground py-16 sm:py-20">
        <div className="layout-shell layout-stack">
          <div className="max-w-3xl">
            <p className="text-sm text-muted-foreground">{UI_COPY.home.heroEyebrow}</p>
            <h2 className="text-2xl sm:text-3xl font-semibold mt-2">{UI_COPY.home.heroTitle}</h2>
            <p className="mt-3 text-base text-muted-foreground leading-relaxed">{UI_COPY.home.heroDesc}</p>
          </div>

          <HomeFeatureGrid />

          <div id="quick-links" className="layout-stack">
            <h3 className="text-xl font-semibold">Tự xem nhanh các khu vực</h3>
            <HomeQuickLinks />
          </div>
        </div>
      </main>
    </>
  );
};

export default HomePage;
