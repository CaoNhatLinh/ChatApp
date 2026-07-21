import { ArrowLeft, Menu, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const BRAND_NAME = "NovaChat";
const BRAND_ACCENT = "#F16524";
const ERROR_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260713_234424_b1332b69-2e69-4302-8dbc-40f86846afbd.mp4";

const NAV_LINKS = ["About Us", "Programs", "Reviews", "FAQ", "Contacts"] as const;
const MENU_ITEMS = NAV_LINKS;

const TinyLogo = () => {
  return (
    <a href="/" className="inline-flex items-center gap-2" aria-label="Back to home">
      <span className="grid grid-cols-2 gap-0.5">
        <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
        <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
        <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
        <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
      </span>
      <span className="text-white font-bold text-lg sm:text-xl ml-1">{BRAND_NAME}</span>
    </a>
  );
};

export const NotFound = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scaleY, setScaleY] = useState(1.2);
  const errorTextRef = useRef<HTMLHeadingElement>(null);

  const menuTransitionClass = isOpen ? "translate-x-0" : "translate-x-full";

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleMeasure = () => {
    if (!errorTextRef.current) return;
    const height = errorTextRef.current.offsetHeight || 1;
    const computed = (window.innerHeight / height) * 1.4;
    setScaleY(Math.max(1.05, Math.min(2.8, computed)));
  };

  useEffect(() => {
    handleMeasure();
    window.addEventListener("resize", handleMeasure);
    return () => window.removeEventListener("resize", handleMeasure);
  }, []);

  const menuLinks = useMemo(
    () => NAV_LINKS.map((item, index) => ({ item, delay: `${150 + index * 60}ms` })),
    []
  );

  return (
    <main className="relative min-h-screen h-screen w-full overflow-hidden flex flex-col bg-gradient-to-b from-[#FF8233] to-[#FDAC55]">
      <div className="absolute inset-0 pointer-events-none opacity-[0.08]" aria-hidden="true" />

      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          opacity: 0.8,
          WebkitMaskImage: "linear-gradient(to bottom, black 40%, transparent 95%)",
          maskImage: "linear-gradient(to bottom, black 40%, transparent 95%)",
        }}
      >
        <div className="relative">
          <h1
            ref={errorTextRef}
            className="text-[clamp(200px,48vw,800px)] leading-none tracking-tighter text-white font-black whitespace-nowrap origin-center"
            style={{ transform: `scale(1.15, ${scaleY})` }}
          >
            404
          </h1>
          <div
            className="absolute inset-0 mx-auto mt-auto mb-auto rounded-full bg-white h-[22vh] sm:h-[26vh] md:h-[50vh] w-[clamp(120px,20vw,400px)]"
            style={{ transform: `scaleY(${scaleY})`, transformOrigin: "center" }}
          />
        </div>
      </div>

      <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 md:px-12 py-4 sm:py-5">
        <TinyLogo />
        <nav className="hidden md:flex items-center gap-1">
          {MENU_ITEMS.map((item) => (
            <a
              key={item}
              href="#"
              className="px-4 py-1.5 text-sm font-medium rounded-full bg-white"
              style={{ color: BRAND_ACCENT }}
            >
              {item}
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 sm:px-5 sm:py-2.5 text-white transition-colors"
          style={{ backgroundColor: BRAND_ACCENT }}
          aria-label="Open menu"
        >
          <Menu size={16} />
          <span className="hidden sm:inline text-sm font-medium">Menu</span>
        </button>
      </header>

      <div
        className={`fixed inset-0 z-50 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          aria-label="Close menu"
        />
        <aside
          className={`absolute top-0 right-0 h-full w-full sm:w-[380px] bg-[linear-gradient(135deg,#FF6B1A_0%,#FF9642_100%)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${menuTransitionClass}`}
          style={{ transitionProperty: "transform, opacity" }}
        >
          <div className="flex items-center justify-between px-6 py-5">
            <TinyLogo />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-10 h-10 rounded-full bg-white/20 text-white hover:bg-white/30 inline-flex items-center justify-center"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <div className="px-4 py-6 space-y-2">
            {menuLinks.map((entry) => (
              <a
                key={entry.item}
                href="#"
                onClick={() => setIsOpen(false)}
                className="block px-6 py-4 text-lg font-semibold text-white rounded-2xl bg-white/10 hover:bg-white/20 transition-all duration-300"
                style={{
                  opacity: isOpen ? 1 : 0,
                  transform: isOpen ? "translateY(0)" : "translateY(1rem)",
                  transitionDelay: isOpen ? entry.delay : "0ms",
                }}
              >
                {entry.item}
              </a>
            ))}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <a
              href="/"
              className="inline-flex w-full justify-center items-center gap-2 py-4 rounded-full bg-white font-semibold text-base transition-transform hover:scale-[1.02]"
              style={{ color: BRAND_ACCENT, transitionDuration: "450ms", transitionDelay: isOpen ? "450ms" : "0ms" }}
            >
              <ArrowLeft size={18} />
              Back to Home
            </a>
          </div>
        </aside>
      </div>

      <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ marginTop: "calc(-6vh - 40px)" }}>
        <div className="w-[120vw] h-[85vh] sm:w-[70vw] sm:h-[70vh] md:w-[62vw] md:h-[78vh]">
          <video
            className="w-full h-full object-contain mix-blend-darken"
            autoPlay
            loop
            muted
            playsInline
          >
            <source src={ERROR_VIDEO_URL} type="video/mp4" />
          </video>
        </div>
      </div>

      <section className="relative z-30 mt-auto pb-8 sm:pb-16 flex flex-col items-center text-center px-4">
        <p className="text-white text-lg sm:text-xl md:text-2xl font-medium mb-3 sm:mb-4">
          Oops, something went wrong!
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 rounded-full font-semibold text-sm sm:text-base text-white transition-all hover:scale-105 hover:shadow-lg"
          style={{ backgroundColor: BRAND_ACCENT }}
        >
          <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
          Back to Home
        </a>
      </section>
    </main>
  );
};

export default NotFound;
