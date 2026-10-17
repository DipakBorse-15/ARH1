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
      <CollectionTiles collections={shownCollections} categorySlug={category?.slug} />
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

/**
 * Collections, in groups of 4.
 *
 *  Web (sm and up) - "bento":            Phone - normal 2 x 2 grid:
 *    ┌──────┬────────┬──────┐               ┌───────┬───────┐
 *    │      │   B    │      │               │   A   │   B   │
 *    │  A   ├────────┤  D   │               ├───────┼───────┤
 *    │      │   C    │      │               │   C   │   D   │
 *    └──────┴────────┴──────┘               └───────┴───────┘
 *
 * Size: on a phone one group of 4 is 5.5 inch tall (MOBILE_BLOCK_HEIGHT),
 * i.e. two rows of rounded cards. On web it is 2 rows of 210px (tablet) /
 * 300px (desktop), the middle column a bit wider (1 : 1.2 : 1). A last group
 * with fewer than 4 collections adapts. Phones use the collection's
 * mobile_image when one is uploaded.
 *
 * Hover: tile lifts, photo zooms, shade deepens, name rises, underline draws in.
 * The entrance animation sits on a wrapper and the hover effects on the inner
 * link on purpose: a finished CSS animation (fill-mode "both") keeps owning its
 * element's `transform`, which would silently swallow any hover transform
 * placed on that same element.
 */
const MOBILE_BLOCK_HEIGHT = "h-[5.5in]"; // change this one value to resize the phone layout

function CollectionTiles({ collections, categorySlug }: { collections: Collection[]; categorySlug?: string }) {
  if (!collections.length) return null;

  const groups: Collection[][] = [];
  for (let i = 0; i < collections.length; i += 4) groups.push(collections.slice(i, i + 4));

  return (
    <section className="mx-auto max-w-7xl space-y-2 px-3 py-6 sm:space-y-4 sm:px-6 sm:py-10">
      {groups.map((group, gi) => {
        const layout = BENTO[group.length];
        return (
          <div
            key={gi}
            className={`grid grid-rows-2 gap-3 ${MOBILE_BLOCK_HEIGHT} sm:h-auto sm:grid-rows-[repeat(2,210px)] sm:gap-4 lg:grid-rows-[repeat(2,300px)] ${layout.grid}`}
          >
            {group.map((c, i) => (
              <CollectionTile
                key={c.id}
                collection={c}
                href={collectionHref(c.slug, categorySlug)}
                cell={layout.cells[i]}
                delay={Math.min(gi * 4 + i, 9) * 90}
              />
            ))}
          </div>
        );
      })}
    </section>
  );
}

// Phone: plain 2-column grid (2 rows). sm and up: the bento from the diagram above.
// Static class strings (not built dynamically) so Tailwind keeps every one of them.
const BENTO: Record<number, { grid: string; cells: string[] }> = {
  4: {
    grid: "grid-cols-2 sm:grid-cols-[1fr_1.2fr_1fr]",
    cells: [
      "sm:col-start-1 sm:row-start-1 sm:row-span-2",
      "sm:col-start-2 sm:row-start-1",
      "sm:col-start-2 sm:row-start-2",
      "sm:col-start-3 sm:row-start-1 sm:row-span-2",
    ],
  },
  3: {
    grid: "grid-cols-2 sm:grid-cols-[1fr_1.2fr]",
    cells: [
      "sm:col-start-1 sm:row-start-1 sm:row-span-2",
      "sm:col-start-2 sm:row-start-1",
      "col-span-2 sm:col-span-1 sm:col-start-2 sm:row-start-2",
    ],
  },
  2: {
    grid: "grid-cols-2 sm:grid-cols-2",
    cells: ["row-span-2 sm:col-start-1 sm:row-start-1", "row-span-2 sm:col-start-2 sm:row-start-1"],
  },
  1: {
    grid: "grid-cols-2 sm:grid-cols-1 sm:mx-auto sm:max-w-md",
    cells: ["col-span-2 row-span-2 sm:col-span-1"],
  },
};

function CollectionTile({ collection: c, href, cell, delay }: { collection: Collection; href: string; cell: string; delay: number }) {
  return (
    <div className={`${cell} animate-fade-rise-in min-h-0`} style={{ animationDelay: `${delay}ms` }}>
      <Link
        to={href}
        className="group relative block h-full w-full overflow-hidden rounded-2xl bg-stone-800 shadow-md shadow-stone-900/10 ring-0 ring-rose-900/0 transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-rose-900/30 hover:ring-4 hover:ring-rose-900/30 active:scale-[0.98] sm:rounded-3xl"
      >
        {c.image || c.mobile_image ? (
          <picture className="block h-full w-full">
            {c.mobile_image && <source media="(max-width: 639px)" srcSet={c.mobile_image} />}
            <img
              src={c.image || c.mobile_image || ""}
              alt={c.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            />
          </picture>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-900 to-amber-700 text-4xl transition-transform duration-700 group-hover:scale-110 sm:text-6xl">
            🪷
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent transition-opacity duration-500 group-hover:from-rose-950/80" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 px-1.5 pb-3 text-center transition-transform duration-500 ease-out group-hover:-translate-y-1.5 sm:gap-1.5 sm:px-3 sm:pb-5">
          <span className="line-clamp-2 font-serif text-sm font-semibold leading-tight text-white drop-shadow-md sm:text-xl lg:text-2xl">
            {c.name}
          </span>
          <span className="h-0.5 w-0 rounded-full bg-white/90 transition-all duration-500 group-hover:w-10 sm:group-hover:w-16" />
        </div>
      </Link>
    </div>
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
