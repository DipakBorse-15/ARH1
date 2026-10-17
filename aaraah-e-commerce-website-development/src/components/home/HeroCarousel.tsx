import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import type { HeroSlide } from "@/types";

/** Auto-rotating banner carousel. Slide 1 is always the built-in AARAAH banner;
 *  the banners uploaded from the admin panel follow as slide 2, 3, ... */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const { settings } = useSiteSettings();
  const logo = settings?.logo_url;
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = slides.length + 1; // +1 = the built-in default banner (always first)
  const active = index % total;
  const hasMobileImages = slides.some((x) => !!x.mobile_image);

  useEffect(() => {
    if (total <= 1) return;
    timer.current = setInterval(() => setIndex((i) => (i + 1) % total), 5000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [total]);

  return (
    <section className="relative overflow-hidden bg-stone-900 text-white sm:bg-amber-50">
      {/* All slides share one grid cell so the banner never changes height while rotating.
          Web: centred frame, 74.8% of the screen wide (max 1418px, so zooming out does not stretch it). Phones: full width. */}
      <div className="relative grid w-full sm:mx-auto sm:w-[74.8%] sm:max-w-[1418px] sm:aspect-[1.988] sm:overflow-hidden">
        {/* Slide 1 — default banner */}
        <div
          aria-hidden={active !== 0}
          className={`col-start-1 row-start-1 bg-gradient-to-br from-rose-950 via-rose-900 to-amber-800 ${active === 0 ? "" : "invisible"}`}
        >
          <div className="mx-auto grid h-full max-w-7xl gap-8 px-4 py-16 sm:content-center sm:px-6 sm:py-6 md:grid-cols-2 md:items-center md:py-10">
            <div className="flex flex-col justify-center gap-3 2xl:gap-5">
              <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide">
                Handpicked Indian Ethnic Wear
              </span>
              <h1 className="font-serif text-4xl font-bold leading-tight sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl">
                Drape yourself in timeless Indian elegance
              </h1>
              <p className="max-w-md text-rose-50/90 sm:text-sm 2xl:text-base">
                Discover sarees, kurties, lehengas, dupattas and more, crafted for celebrations and everyday grace.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/category/sarees" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-rose-900 shadow-lg sm:px-4 sm:py-2 sm:text-xs xl:px-5 xl:text-sm 2xl:px-6 2xl:py-3">
                  Shop Sarees
                </Link>
                <Link to="/collection/new-arrival" className="rounded-full border border-white/60 px-6 py-3 text-sm font-semibold sm:px-4 sm:py-2 sm:text-xs xl:px-5 xl:text-sm 2xl:px-6 2xl:py-3">
                  New Arrivals
                </Link>
              </div>
            </div>
            <div className="hidden items-center justify-center md:flex">
              {logo ? (
                <div
                  className="flex items-center justify-center rounded-full bg-amber-50 shadow-2xl shadow-black/30"
                  style={{ width: "clamp(200px, 22vw, 420px)", height: "clamp(200px, 22vw, 420px)" }}
                >
                  <img
                    src={logo}
                    alt={settings?.site_name || "AARAAH"}
                    className="max-h-[86%] max-w-[86%] object-contain"
                  />
                </div>
              ) : (
                <div
                  className="rounded-full bg-white/10 backdrop-blur"
                  style={{ width: "clamp(200px, 22vw, 420px)", height: "clamp(200px, 22vw, 420px)" }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Slides 2.. — banners uploaded from the admin panel (only the visible one loads its image) */}
        {slides.map((slide, i) => {
          const isActive = active === i + 1;
          return (
            <div
              key={slide.id}
              aria-hidden={!isActive}
              className={`relative col-start-1 row-start-1 bg-stone-900 ${hasMobileImages ? "aspect-[4/5]" : "aspect-[16/7]"} sm:aspect-auto ${isActive ? "" : "invisible"}`}
            >
              {isActive && (
                <>
                  <picture>
                    {slide.mobile_image && <source media="(max-width: 639px)" srcSet={slide.mobile_image} />}
                    <img src={slide.image} alt={slide.title} className="absolute inset-0 h-full w-full object-cover" />
                  </picture>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
                    <div className="mx-auto max-w-7xl">
                      <h2 className="font-serif text-2xl font-bold sm:text-4xl">{slide.title}</h2>
                      {slide.subtitle && <p className="mt-1 max-w-md text-sm text-white/90 sm:text-base">{slide.subtitle}</p>}
                      {slide.cta_text && slide.cta_link && (
                        <Link
                          to={slide.cta_link}
                          className="mt-4 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-rose-900 shadow-lg"
                        >
                          {slide.cta_text}
                        </Link>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {slides.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setIndex((active - 1 + total) % total)}
              aria-label="Previous slide"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-stone-900 hover:bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setIndex((active + 1) % total)}
              aria-label="Next slide"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-stone-900 hover:bg-white"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {Array.from({ length: total }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => setIndex(i)}
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
