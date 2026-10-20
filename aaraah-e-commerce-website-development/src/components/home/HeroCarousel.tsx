import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import type { HeroSlide } from "@/types";
import { categoryHref } from "@/lib/categoryLinks";

const SLIDE_MS = 700;

/** True once the carousel has moved at least once since the page was loaded (survives going to another page and back). */
let carouselHasMoved = false;

const SLIDE_CSS = `
@keyframes hero-in-r{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes hero-out-l{from{transform:translateX(0)}to{transform:translateX(-100%)}}
@keyframes hero-in-l{from{transform:translateX(-100%)}to{transform:translateX(0)}}
@keyframes hero-out-r{from{transform:translateX(0)}to{transform:translateX(100%)}}
.hero-in-r{animation:hero-in-r ${SLIDE_MS}ms cubic-bezier(.65,0,.35,1) both}
.hero-out-l{animation:hero-out-l ${SLIDE_MS}ms cubic-bezier(.65,0,.35,1) both}
.hero-in-l{animation:hero-in-l ${SLIDE_MS}ms cubic-bezier(.65,0,.35,1) both}
.hero-out-r{animation:hero-out-r ${SLIDE_MS}ms cubic-bezier(.65,0,.35,1) both}
@media (prefers-reduced-motion: reduce){.hero-in-r,.hero-out-l,.hero-in-l,.hero-out-r{animation:none}}
`;

/** Auto-rotating banner carousel. Slide 1 is always the built-in AARAAH banner;
 *  the banners uploaded from the admin panel follow as slide 2, 3, ... */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const { settings } = useSiteSettings();
  const logo = settings?.logo_url;
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null); // slide that is sliding out
  const [dir, setDir] = useState<1 | -1>(1); // 1 = next (slides to the left), -1 = previous
  const [cycled, setCycled] = useState(carouselHasMoved); // true once the carousel has moved at least once
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = slides.length + 1; // +1 = the built-in default banner (always first)
  const active = index % total;

  // The default banner stays 5 s only the first time the page loads. After that every slide
  // (including the default one) stays the seconds set in Admin → Home Editor → Banners.
  const adminSeconds = Math.min(60, Math.max(2, Number(settings?.hero_slide_seconds) || 5));
  const delay = !cycled ? 5000 : adminSeconds * 1000;

  function go(next: number, direction: 1 | -1) {
    if (next === active) return;
    setDir(direction);
    setLeaving(active);
    setIndex(next);
    carouselHasMoved = true;
    setCycled(true);
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setLeaving(null), SLIDE_MS);
  }

  useEffect(() => {
    if (total <= 1) return;
    const t = setTimeout(() => go((active + 1) % total, 1), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, total, delay]);

  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  /** Slide animation class for a slide: the new one comes in, the old one goes out. */
  function slideClass(i: number): string {
    if (i === active) return leaving !== null ? (dir === 1 ? "hero-in-r" : "hero-in-l") : "";
    if (i === leaving) return dir === 1 ? "hero-out-l" : "hero-out-r";
    return "invisible";
  }

  return (
    <section className="relative overflow-hidden bg-amber-50 text-white">
      {/* All slides share one grid cell so the banner never changes height while rotating.
          Web: centred frame, 74.8% of the screen wide (max 1418px, so zooming out does not stretch it). Phones: full width. */}
      <style>{SLIDE_CSS}</style>
      <div className="@container relative mx-auto grid aspect-[1.988] w-full overflow-hidden sm:w-[74.8%] sm:max-w-[1418px]">
        {/* Slide 1 — default banner */}
        <div
          aria-hidden={active !== 0}
          className={`col-start-1 row-start-1 bg-gradient-to-br from-rose-950 via-rose-900 to-amber-800 ${slideClass(0)}`}
        >
          <div className="mx-auto grid h-full max-w-7xl grid-cols-[1.35fr_1fr] items-center gap-[2cqw] px-[4cqw] py-[3cqw] sm:content-center sm:gap-8 sm:px-6 sm:py-6 md:grid-cols-2 md:py-10">
            <div className="flex flex-col justify-center gap-[1.4cqw] sm:gap-3 2xl:gap-5">
              <span className="w-fit rounded-full bg-white/10 px-[2cqw] py-[0.6cqw] text-[2cqw] font-medium tracking-wide sm:px-3 sm:py-1 sm:text-xs">
                Handpicked Indian Ethnic Wear
              </span>
              <h1 className="font-serif text-[4.6cqw] font-bold leading-tight sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl">
                Drape yourself in timeless Indian elegance
              </h1>
              <p className="max-w-md text-[2.3cqw] leading-snug text-rose-50/90 sm:text-sm sm:leading-normal 2xl:text-base">
                Discover sarees, kurties, lehengas, dupattas and more, crafted for celebrations and everyday grace.
              </p>
              <div className="flex flex-wrap gap-[1.6cqw] sm:gap-3">
                <Link to={categoryHref("sarees")} className="rounded-full bg-white px-[2.4cqw] py-[1.04cqw] text-[1.76cqw] font-semibold text-rose-900 shadow-lg sm:px-4 sm:py-2 sm:text-xs xl:px-5 xl:text-sm 2xl:px-6 2xl:py-3">
                  Shop Sarees
                </Link>
                <Link to="/collection/new-arrival" className="rounded-full border border-white/60 px-[2.4cqw] py-[1.04cqw] text-[1.76cqw] font-semibold sm:px-4 sm:py-2 sm:text-xs xl:px-5 xl:text-sm 2xl:px-6 2xl:py-3">
                  New Arrivals
                </Link>
              </div>
            </div>
            <div className="flex items-center justify-center">
              {logo ? (
                <div
                  className="flex h-[27cqw] w-[27cqw] sm:h-[clamp(200px,22vw,420px)] sm:w-[clamp(200px,22vw,420px)] items-center justify-center rounded-full bg-amber-50 shadow-2xl shadow-black/30"
                >
                  <img
                    src={logo}
                    alt={settings?.site_name || "AARAAH"}
                    className="max-h-[86%] max-w-[86%] object-contain"
                  />
                </div>
              ) : (
                <div className="h-[27cqw] w-[27cqw] sm:h-[clamp(200px,22vw,420px)] sm:w-[clamp(200px,22vw,420px)] rounded-full bg-white/10 backdrop-blur" />
              )}
            </div>
          </div>
        </div>

        {/* Slides 2.. — banners uploaded from the admin panel (only the visible one loads its image) */}
        {slides.map((slide, i) => {
          const isShown = active === i + 1 || leaving === i + 1;
          return (
            <div
              key={slide.id}
              aria-hidden={active !== i + 1}
              className={`relative col-start-1 row-start-1 bg-stone-900 ${slideClass(i + 1)}`}
            >
              {isShown && (
                <>
                  <img src={slide.image} alt={slide.title || "AARAAH banner"} className="absolute inset-0 h-full w-full object-cover" />
                  {(slide.title || slide.subtitle || (slide.cta_text && slide.cta_link)) && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  )}
                  {(slide.title || slide.subtitle || (slide.cta_text && slide.cta_link)) && (
                    <div className="absolute inset-x-0 bottom-0 p-[3cqw] sm:p-10">
                      <div className="mx-auto max-w-7xl">
                        {slide.title && <h2 className="font-serif text-[4.4cqw] font-bold leading-tight sm:text-4xl">{slide.title}</h2>}
                        {slide.subtitle && <p className="mt-[0.4cqw] max-w-md text-[2.4cqw] text-white/90 sm:mt-1 sm:text-base">{slide.subtitle}</p>}
                        {slide.cta_text && slide.cta_link && (
                          <Link
                            to={slide.cta_link}
                            className="mt-[1.6cqw] inline-block rounded-full bg-white px-[3.4cqw] py-[1.2cqw] text-[2.3cqw] font-semibold text-rose-900 shadow-lg sm:mt-4 sm:px-6 sm:py-2.5 sm:text-sm"
                          >
                            {slide.cta_text}
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {slides.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => go((active - 1 + total) % total, -1)}
              aria-label="Previous slide"
              className="absolute left-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-stone-900 hover:bg-white sm:left-3 sm:h-auto sm:w-auto sm:p-2"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go((active + 1) % total, 1)}
              aria-label="Next slide"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-stone-900 hover:bg-white sm:right-3 sm:h-auto sm:w-auto sm:p-2"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {Array.from({ length: total }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => go(i, i > active ? 1 : -1)}
                  className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
