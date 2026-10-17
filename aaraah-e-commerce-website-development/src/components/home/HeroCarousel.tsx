import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { HeroSlide } from "@/types";

/** Full-width auto-rotating banner carousel, managed from the admin panel.
 *  Falls back to the original static hero when no slides are configured yet. */
export function HeroCarousel({ slides, fallback }: { slides: HeroSlide[]; fallback?: ReactNode }) {
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (slides.length <= 1) return;
    timer.current = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [slides.length]);

  if (slides.length === 0) {
    if (fallback) return <>{fallback}</>;
    return (
      <section className="relative overflow-hidden bg-gradient-to-br from-rose-950 via-rose-900 to-amber-800 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <div className="flex flex-col justify-center gap-5">
            <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide">
              Handpicked Indian Ethnic Wear
            </span>
            <h1 className="font-serif text-4xl font-bold leading-tight sm:text-5xl">
              Drape yourself in timeless Indian elegance
            </h1>
            <p className="max-w-md text-rose-50/90">
              Discover sarees, kurties, lehengas, dupattas and more, crafted for celebrations and everyday grace.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/category/sarees" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-rose-900 shadow-lg">
                Shop Sarees
              </Link>
              <Link to="/collection/new-arrival" className="rounded-full border border-white/60 px-6 py-3 text-sm font-semibold">
                New Arrivals
              </Link>
            </div>
          </div>
          <div className="hidden items-center justify-center md:flex">
            <div className="h-72 w-72 rounded-full bg-white/10 backdrop-blur" />
          </div>
        </div>
      </section>
    );
  }

  const slide = slides[index];
  const hasMobileImages = slides.some((x) => !!x.mobile_image);

  return (
    <section className="relative overflow-hidden bg-stone-900 text-white sm:bg-transparent">
      {/* Phones: a taller 4:5 frame when the banners have mobile images, else the original wide strip. */}
      <div className={`relative w-full sm:mx-auto sm:w-[74.8%] sm:aspect-[1.789] sm:overflow-hidden ${hasMobileImages ? "aspect-[4/5]" : "aspect-[16/7]"}`}>
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

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
              aria-label="Previous slide"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-stone-900 hover:bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % slides.length)}
              aria-label="Next slide"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-stone-900 hover:bg-white"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
