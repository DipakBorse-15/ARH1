import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ProductGrid } from "@/components/product/ProductGrid";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { fetchCollections } from "@/services/collections";
import { fetchCategoryCollections } from "@/services/categoryCollections";
import { fetchHomeFeed, type HomeCollectionRow, type HomeFeed, type SimilarItem } from "@/services/products";
import { friendlyError } from "@/lib/supabase";
import type { Collection, CategoryCollection } from "@/types";

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
  const [configured, setConfigured] = useState<CategoryCollection[]>([]);

  const categoryId = category?.id;

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [cols, cfg] = await Promise.all([
        fetchCollections(),
        categoryId ? fetchCategoryCollections(categoryId) : Promise.resolve([] as CategoryCollection[]),
      ]);
      // Collections the admin set up for this category come first, in their position order.
      const cfgCols = cfg.map((r) => r.collection as Collection);
      const ordered = cfg.length ? [...cfgCols, ...cols.filter((c) => !cfgCols.some((x) => x.id === c.id))] : cols;
      const f = await fetchHomeFeed(ordered, { latestCount: LATEST_COUNT, perCollection: PER_COLLECTION, categoryId });
      setCollections(cols);
      setConfigured(cfg);
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
  // If the admin set up collections for this category (Admin → Categories → Collections), those are
  // shown, each with this category's own images; one without products here says "Coming Soon".
  const withProducts = new Set(feed.collectionRows.map((r) => r.collection.id));
  const shownCollections: Collection[] = !category
    ? collections
    : configured.length
      ? configured.map((r) => {
          const col = r.collection as Collection;
          return {
            ...col,
            image: r.image || col.image,
            mobile_image: r.mobile_image || (r.image ? null : col.mobile_image),
          };
        })
      : feed.collectionRows.map((r) => r.collection);
  const comingSoonIds = new Set(
    category && configured.length ? configured.filter((r) => !withProducts.has(r.collection_id)).map((r) => r.collection_id) : []
  );

  if (category && feed.latest.length === 0) {
    return <ComingSoon name={category.name} />;
  }

  return (
    <>
      <CollectionTiles collections={shownCollections} categorySlug={category?.slug} comingSoonIds={comingSoonIds} />
      <LatestLaunches items={feed.latest} category={category} />
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
 * i.e. two rows of rounded cards. On web it is 2 rows of 188px (tablet) /
 * 269px (desktop) - the block is 95% as wide and 10% lower than before - the middle column a bit wider (1 : 1.2 : 1). A last group
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

function CollectionTiles({ collections, categorySlug, comingSoonIds }: { collections: Collection[]; categorySlug?: string; comingSoonIds?: Set<string> }) {
  if (!collections.length) return null;

  const groups: Collection[][] = [];
  for (let i = 0; i < collections.length; i += 4) groups.push(collections.slice(i, i + 4));

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-amber-50 via-orange-50/60 to-amber-50 py-10 sm:py-16">
      <CornerLeaf className="pointer-events-none absolute -left-6 -top-6 h-40 w-40 text-amber-800 sm:h-56 sm:w-56" />
      <CornerLeaf className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 rotate-90 text-amber-800 sm:h-56 sm:w-56" />

      <div className="relative mx-auto max-w-7xl space-y-3 px-3 sm:space-y-4 sm:px-6">
        <div className="mb-6 text-center sm:mb-10">
          <p className="text-xs font-semibold tracking-[0.3em] text-amber-800/80">EXPLORE OUR</p>
          <h2 className="mt-1 font-serif text-4xl font-bold text-stone-900 sm:text-5xl">Top Collections</h2>
          <div className="mt-3 flex items-center justify-center gap-3 text-amber-800/70">
            <span className="h-px w-10 bg-amber-800/40" />
            <LotusDivider className="h-5 w-5" />
            <span className="h-px w-10 bg-amber-800/40" />
          </div>
          <p className="mt-3 text-sm text-stone-600">Timeless Styles &nbsp;|&nbsp; Premium Fabrics &nbsp;|&nbsp; For Every You</p>
        </div>

      {groups.map((group, gi) => {
        const layout = BENTO[group.length];
        return (
          <div
            key={gi}
            className={`grid grid-rows-2 gap-3 ${MOBILE_BLOCK_HEIGHT} sm:mx-auto sm:h-auto sm:w-[95%] sm:grid-rows-[repeat(2,188px)] sm:gap-4 lg:grid-rows-[repeat(2,269px)] ${layout.grid}`}
          >
            {group.map((c, i) => (
              <CollectionTile
                key={c.id}
                collection={c}
                href={collectionHref(c.slug, categorySlug)}
                cell={layout.cells[i]}
                comingSoon={comingSoonIds?.has(c.id)}
                delay={Math.min(gi * 4 + i, 9) * 90}
              />
            ))}
          </div>
        );
      })}
      </div>
    </section>
  );
}

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
    grid: "grid-cols-2 sm:grid-cols-1 sm:max-w-md",
    cells: ["col-span-2 row-span-2 sm:col-span-1"],
  },
};

function CollectionTile({ collection: c, href, cell, delay, comingSoon }: { collection: Collection; href: string; cell: string; delay: number; comingSoon?: boolean }) {
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
        {comingSoon && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-rose-900 sm:right-3 sm:top-3 sm:text-xs">
            Coming Soon
          </span>
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
function LatestLaunches({ items, category }: { items: SimilarItem[]; category?: { slug: string; name: string } }) {
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {category ? (
        // Category page: heading on the left, "Show all <category>" on the right.
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div>
            <h2 className="font-serif text-3xl font-semibold text-stone-900">Latest Launches</h2>
            <p className="mt-1 text-sm text-stone-500">Fresh off the loom — our newest arrivals</p>
          </div>
          <Link
            to={`/category/${category.slug}/all`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-rose-900 px-4 py-2 text-sm font-semibold text-rose-900 transition-all duration-300 hover:bg-rose-900 hover:text-white sm:px-5"
          >
            Show all {category.name} <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : (
        <div className="mb-6 text-center">
          <h2 className="font-serif text-3xl font-semibold text-stone-900">Latest Launches</h2>
          <p className="mt-1 text-sm text-stone-500">Fresh off the loom — our newest arrivals</p>
        </div>
      )}
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
