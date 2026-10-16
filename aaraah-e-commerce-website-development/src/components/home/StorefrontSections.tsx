import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ProductGrid } from "@/components/product/ProductGrid";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { fetchCollections } from "@/services/collections";
import { fetchHomeFeed, type HomeCollectionRow, type HomeFeed, type SimilarItem } from "@/services/products";
import { friendlyError } from "@/lib/supabase";
import type { Collection } from "@/types";

export const LATEST_COUNT = 12; // 3 rows of 4
export const PER_COLLECTION = 8; // 2 rows of 4

/**
 * EVERYTHING below the hero banner, shared by the Home page and every
 * category page. Change the structure here ONCE and both update together:
 *
 *   1. Collection circles
 *   2. Latest launches (12)
 *   3. Each collection's newest 8, with a "More Products" button
 *
 * Home passes no `category` (whole store). A category page passes its
 * category, so the collections, latest and per-collection rows are all
 * limited to that category.
 */
export function StorefrontSections({ category }: { category?: { id: string; slug: string; name: string } }) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [feed, setFeed] = useState<HomeFeed>({ latest: [], collectionRows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryId = category?.id;

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const cols = await fetchCollections();
      const f = await fetchHomeFeed(cols, { latestCount: LATEST_COUNT, perCollection: PER_COLLECTION, categoryId });
      setCollections(cols);
      setFeed(f);
    } catch (err) {
      setError(friendlyError(err, "Could not load products right now."));
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingState label="Loading collections…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  // On a category page only the collections that actually have products in
  // that category are listed; on the home page every active collection is.
  const shownCollections = category ? feed.collectionRows.map((r) => r.collection) : collections;

  if (category && feed.latest.length === 0) {
    return <ComingSoon name={category.name} />;
  }

  return (
    <>
      <CollectionCircles collections={shownCollections} categorySlug={category?.slug} />
      <LatestLaunches items={feed.latest} />
      {feed.collectionRows.map((row) => (
        <CollectionProducts key={row.collection.id} row={row} perCollection={PER_COLLECTION} categorySlug={category?.slug} />
      ))}
    </>
  );
}

function ComingSoon({ name }: { name: string }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
      <p className="text-xs font-semibold tracking-[0.3em] text-amber-800/80">{name.toUpperCase()}</p>
      <h2 className="mt-2 font-serif text-4xl font-bold text-stone-900">Coming Soon</h2>
      <p className="mt-3 text-sm text-stone-500">We're putting the finishing touches on this collection. Please check back soon.</p>
      <Link
        to="/"
        className="mt-8 inline-block rounded-full border-2 border-rose-900 px-8 py-3 text-sm font-semibold text-rose-900 transition hover:bg-rose-900 hover:text-white"
      >
        Continue Shopping
      </Link>
    </section>
  );
}

/** Big circular collection shortcuts (same look the category circles had).
 *
 *  The entrance animation lives on a wrapper and the hover effects on the inner
 *  link on purpose: a finished CSS animation (fill-mode "both") keeps owning its
 *  element's `transform`, which would silently swallow any hover transform
 *  placed on that same element. */
function CollectionCircles({ collections, categorySlug }: { collections: Collection[]; categorySlug?: string }) {
  if (!collections.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-14">
      {/* Mobile: ONE row, exactly 4 per screen, swipe for more (scroll-snap).
          sm+: wrapped, centred grid. */}
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory flex-nowrap overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:gap-x-10 sm:gap-y-14 sm:overflow-visible sm:px-0 sm:pb-0">
        {collections.map((c, i) => (
          <div key={c.id} className="w-1/4 flex-none snap-start sm:w-auto sm:flex-initial animate-pop-in" style={{ animationDelay: `${Math.min(i, 9) * 90}ms` }}>
            <Link
              to={collectionHref(c.slug, categorySlug)}
              className="group mx-auto flex w-full flex-col items-center gap-2 text-center sm:w-[170px] sm:gap-4"
            >
              <div className="relative flex h-[57px] w-[57px] items-center justify-center overflow-hidden rounded-full border-2 border-stone-200 bg-stone-100 text-stone-300 shadow-md ring-4 ring-transparent transition-all duration-500 ease-out group-hover:-translate-y-3 group-hover:scale-110 group-hover:border-rose-900 group-hover:shadow-2xl group-hover:shadow-rose-900/40 group-hover:ring-rose-900/20 sm:h-[170px] sm:w-[170px]">
                {c.image ? (
                  <img
                    src={c.image}
                    alt={c.name}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-125"
                  />
                ) : (
                  <span className="text-[1.7rem] transition-transform duration-500 group-hover:scale-125 sm:text-[4.2rem]">🪷</span>
                )}
                <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-t from-rose-950/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <p className="line-clamp-2 px-0.5 font-serif text-xs font-semibold text-stone-800 transition-colors duration-300 group-hover:text-rose-900 sm:text-xl">
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

/** On a category page the collection page is narrowed to that category too. */
function collectionHref(collectionSlug: string, categorySlug?: string) {
  return categorySlug ? `/collection/${collectionSlug}?category=${encodeURIComponent(categorySlug)}` : `/collection/${collectionSlug}`;
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
function CollectionProducts({ row, perCollection, categorySlug }: { row: HomeCollectionRow; perCollection: number; categorySlug?: string }) {
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
            to={collectionHref(row.collection.slug, categorySlug)}
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
