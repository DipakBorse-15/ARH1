import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { ProductGrid } from "@/components/product/ProductGrid";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { siteConfig, isSupabaseConfigured } from "@/config/site";
import { fetchCategoriesByRecentActivity } from "@/services/categories";
import { fetchCollections } from "@/services/collections";
import { fetchHomeFeed, type HomeCollectionRow, type HomeFeed, type SimilarItem } from "@/services/products";
import { fetchActiveHeroSlides } from "@/services/heroSlides";
import { friendlyError } from "@/lib/supabase";
import type { Category, Collection, HeroSlide } from "@/types";

const LATEST_COUNT = 12; // 3 rows of 4
const PER_COLLECTION = 8; // 2 rows of 4

export default function Home() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [feed, setFeed] = useState<HomeFeed>({ latest: [], collectionRows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [hs, cats, cols] = await Promise.all([
        fetchActiveHeroSlides(),
        fetchCategoriesByRecentActivity(),
        fetchCollections(),
      ]);
      setSlides(hs);
      setCategories(cats);
      setCollections(cols);
      setFeed(await fetchHomeFeed(cols, { latestCount: LATEST_COUNT, perCollection: PER_COLLECTION }));
    } catch (err) {
      setError(friendlyError(err, "Could not load the homepage right now."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <SEO
        title={`${siteConfig.name} — Premium Indian Ethnic Wear`}
        description="Shop premium sarees, kurtis, dress materials and kurta sets. Elegant, modern Indian ethnic fashion delivered across India."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: siteConfig.name,
          url: siteConfig.url,
        }}
      />

      <HeroCarousel slides={slides} />

      {!isSupabaseConfigured && (
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            Supabase is not configured yet. Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in your <code>.env</code> file, run the SQL migrations in{" "}
            <code>supabase/migrations</code>, then add products from the Admin panel to see live data here.
          </div>
        </div>
      )}

      {loading && <LoadingState label="Loading collections…" />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && (
        <>
          <CategoryShortcuts categories={categories} />

          <LatestLaunches items={feed.latest} />

          <SpotlightCollections collections={collections} />

          {feed.collectionRows.map((row) => (
            <CollectionProducts key={row.collection.id} row={row} perCollection={PER_COLLECTION} />
          ))}
        </>
      )}
    </div>
  );
}

/** Full-width auto-rotating banner carousel, managed from the admin panel.
 *  Falls back to the original static hero when no slides are configured yet. */
function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
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
              Discover sarees, kurtis, dress materials and kurta sets crafted for celebrations and everyday grace.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/category/saree" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-rose-900 shadow-lg">
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

  return (
    <section className="relative overflow-hidden bg-stone-900 text-white">
      <div className="relative aspect-[16/7] w-full sm:aspect-[16/6]">
        <img src={slide.image} alt={slide.title} className="absolute inset-0 h-full w-full object-cover" />
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

/** Big circular category shortcuts. Order comes from fetchCategoriesByRecentActivity,
 *  so the category that just got a new product/colour is first.
 *
 *  The entrance animation lives on a wrapper and the hover effects on the inner
 *  link on purpose: a finished CSS animation (fill-mode "both") keeps owning its
 *  element's `transform`, which would silently swallow any hover transform
 *  placed on that same element. */
function CategoryShortcuts({ categories }: { categories: Category[] }) {
  if (!categories.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-10 sm:gap-x-10 sm:gap-y-14">
        {categories.map((c, i) => (
          <div key={c.id} className="animate-pop-in" style={{ animationDelay: `${Math.min(i, 9) * 90}ms` }}>
            <Link
              to={`/category/${c.slug}`}
              className="group flex w-[121px] flex-col items-center gap-4 text-center sm:w-[202px]"
            >
              <div className="relative flex h-[121px] w-[121px] items-center justify-center overflow-hidden rounded-full border-2 border-stone-200 bg-stone-100 text-stone-300 shadow-md ring-4 ring-transparent transition-all duration-500 ease-out group-hover:-translate-y-3 group-hover:scale-110 group-hover:border-rose-900 group-hover:shadow-2xl group-hover:shadow-rose-900/40 group-hover:ring-rose-900/20 sm:h-[202px] sm:w-[202px]">
                {c.image ? (
                  <img
                    src={c.image}
                    alt={c.name}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-125"
                  />
                ) : (
                  <span className="text-[3.15rem] transition-transform duration-500 group-hover:scale-125 sm:text-[5rem]">🪷</span>
                )}
                <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-t from-rose-950/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <p className="line-clamp-2 font-serif text-base font-semibold text-stone-800 transition-colors duration-300 group-hover:text-rose-900 sm:text-xl">
                  {c.name}
                </p>
                <span className="h-0.5 w-0 rounded-full bg-rose-900 transition-all duration-500 group-hover:w-12" />
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Big editorial-style collection tiles ("Just In" style), replacing the small strip. */
function LotusDivider({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3c1.2 2.5 1.2 5-0 7-1.2-2-1.2-4.5 0-7Z M12 3c-3 1.5-4.5 4-4.5 6.5C9.5 10.5 11 9.5 12 8c1 1.5 2.5 2.5 4.5 1.5C16.5 7 15 4.5 12 3Z M4 12c2.7-1 5.3-.5 7 1-2.6.8-5-.2-7-1Z M20 12c-2.7-1-5.3-.5-7 1 2.6.8 5-.2 7-1Z M12 10c2.2 1.6 3 3.8 2.4 6.2-2-.6-3.4-2.2-3.7-4.3 M12 10c-2.2 1.6-3 3.8-2.4 6.2 2-.6 3.4-2.2 3.7-4.3"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CornerLeaf({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1" opacity="0.35">
        <path d="M10 190C60 160 90 110 80 40" />
        <path d="M80 40C60 60 45 85 42 110" />
        <path d="M80 40C95 65 100 95 92 125" />
        <path d="M30 170C55 155 68 130 65 100" />
      </g>
    </svg>
  );
}

function SpotlightCollections({ collections }: { collections: Collection[] }) {
  if (!collections.length) return null;
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-amber-50 via-orange-50/60 to-amber-50 py-16">
      <CornerLeaf className="pointer-events-none absolute -left-6 -top-6 h-40 w-40 text-amber-800 sm:h-56 sm:w-56" />
      <CornerLeaf className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 rotate-90 text-amber-800 sm:h-56 sm:w-56" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-amber-800/80">EXPLORE OUR</p>
          <h2 className="mt-1 font-serif text-4xl font-bold text-stone-900 sm:text-5xl">Top Collections</h2>
          <div className="mt-3 flex items-center justify-center gap-3 text-amber-800/70">
            <span className="h-px w-10 bg-amber-800/40" />
            <LotusDivider className="h-5 w-5" />
            <span className="h-px w-10 bg-amber-800/40" />
          </div>
          <p className="mt-3 text-sm text-stone-600">Timeless Styles &nbsp;|&nbsp; Premium Fabrics &nbsp;|&nbsp; For Every You</p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {collections.map((c) => (
            <Link
              key={c.id}
              to={`/collection/${c.slug}`}
              className="group relative overflow-hidden rounded-2xl shadow-lg shadow-stone-900/10 transition duration-300 hover:-translate-y-1"
            >
              <div className="aspect-[3/4] w-full bg-stone-800">
                {c.image ? (
                  <img
                    src={c.image}
                    alt={c.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-900 to-amber-700" />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4 pb-5 text-center">
                <span className="font-serif text-xl font-semibold text-white sm:text-2xl">{c.name}</span>
                <LotusDivider className="h-3.5 w-3.5 text-white/70" />
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/70 px-4 py-1.5 text-xs font-medium text-white transition group-hover:bg-white group-hover:text-stone-900">
                  Shop Now <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The newest colours across the whole store, 4 per row. */
function LatestLaunches({ items }: { items: SimilarItem[] }) {
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 text-center">
        <h2 className="font-serif text-3xl font-semibold text-stone-900">Latest Launches</h2>
        <p className="mt-1 text-sm text-stone-500">Fresh off the loom — our newest arrivals</p>
      </div>
      <ProductGrid items={items} columnsClass="grid-cols-2 md:grid-cols-4" />
    </section>
  );
}

/** One collection: its newest colours (4 per row), plus a "More Products"
 *  button only when the collection has more than what is shown. */
function CollectionProducts({ row, perCollection }: { row: HomeCollectionRow; perCollection: number }) {
  const extra = row.total - perCollection;
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 text-center">
        <h2 className="font-serif text-3xl font-semibold text-stone-900">{row.collection.name}</h2>
      </div>
      <ProductGrid items={row.items} columnsClass="grid-cols-2 md:grid-cols-4" />
      {extra > 0 && (
        <div className="mt-8 text-center">
          <Link
            to={`/collection/${row.collection.slug}`}
            className="inline-flex items-center gap-2 rounded-full border-2 border-rose-900 px-8 py-3 text-sm font-semibold text-rose-900 transition-all duration-300 hover:-translate-y-0.5 hover:bg-rose-900 hover:text-white hover:shadow-lg hover:shadow-rose-900/30"
          >
            More Products <span aria-hidden="true">→</span>
            <span className="text-xs font-normal opacity-70">(+{extra})</span>
          </Link>
        </div>
      )}
    </section>
  );
}
