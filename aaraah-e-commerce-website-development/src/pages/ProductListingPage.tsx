import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { ProductGrid } from "@/components/product/ProductGrid";
import { FilterPanel, SortDropdown } from "@/components/product/FilterSort";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { fetchCategoryBySlug } from "@/services/categories";
import { fetchCollectionBySlug, fetchSlugForOldCollectionSlug } from "@/services/collections";
import { collectSizes, fetchProducts, type ProductFilters } from "@/services/products";
import { friendlyError } from "@/lib/supabase";
import { categoryHref } from "@/lib/categoryLinks";
import { listingSeoDescription } from "@/lib/seoText";
import type { Category, Collection, ProductWithVariants } from "@/types";

type Mode = "category" | "collection" | "search";

const PAGE_SIZE = 12;

// Old category URLs (before the 6-category restructure) keep working.
const LEGACY_CATEGORY_SLUGS: Record<string, string> = {
  saree: "sarees",
  kurti: "kurties-kurta-sets",
  "kurta-set-with-dupatta": "kurties-kurta-sets",
};

export function ProductListingPage({ mode }: { mode: Mode }) {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  // "More Products" from a category page opens the collection narrowed to that category.
  const categoryParam = searchParams.get("category") || undefined;

  const [taxonomy, setTaxonomy] = useState<Category | Collection | null>(null);
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProductFilters>({ sort: "newest", page: 1, pageSize: PAGE_SIZE });

  // One effect = one fetch. When the page itself changes (another category / search),
  // the filters are reset first and the fetch happens once with the fresh filters.
  const pageKey = `${mode}|${slug}|${query}|${categoryParam}`;
  const lastKey = useRef(pageKey);
  const requestId = useRef(0);

  useEffect(() => {
    if (lastKey.current !== pageKey) {
      lastKey.current = pageKey;
      const isDefault = filters.sort === "newest" && filters.page === 1 && Object.keys(filters).every((k) => ["sort", "page", "pageSize"].includes(k));
      if (!isDefault) {
        setFilters({ sort: "newest", page: 1, pageSize: PAGE_SIZE });
        return;
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey, filters]);

  async function load() {
    const myId = ++requestId.current;
    const stale = () => myId !== requestId.current;
    setLoading(true);
    setError(null);
    try {
      if (mode === "category" && slug) {
        const cat = await fetchCategoryBySlug(slug);
        if (stale()) return;
        setTaxonomy(cat);
        if (!cat) {
          setProducts([]);
          setTotal(0);
          return;
        }
        const res = await fetchProducts({ ...filters, categorySlug: slug });
        if (stale()) return;
        setProducts(res.products);
        setTotal(res.total);
      } else if (mode === "collection" && slug) {
        const col = await fetchCollectionBySlug(slug);
        if (stale()) return;
        if (!col) {
          // Old web address of a collection whose slug was corrected: send the visitor to the new one.
          const newSlug = await fetchSlugForOldCollectionSlug(slug).catch(() => null);
          if (stale()) return;
          if (newSlug && newSlug !== slug) {
            navigate(`/collection/${newSlug}${window.location.search}`, { replace: true });
            return;
          }
        }
        setTaxonomy(col);
        if (!col) {
          setProducts([]);
          setTotal(0);
          return;
        }
        const res = await fetchProducts({ ...filters, collectionSlug: slug, categorySlug: categoryParam });
        if (stale()) return;
        setProducts(res.products);
        setTotal(res.total);
      } else {
        const res = await fetchProducts({ ...filters, search: query });
        if (stale()) return;
        setProducts(res.products);
        setTotal(res.total);
      }
    } catch (err) {
      if (!stale()) setError(friendlyError(err, "Could not load products."));
    } finally {
      if (!stale()) setLoading(false);
    }
  }

  const availableColors = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.variants.forEach((v) => v.color && v.active && set.add(v.color)));
    return Array.from(set);
  }, [products]);

  const availableSizes = useMemo(() => collectSizes(products), [products]);

  const heading = mode === "search" ? `Search results for "${query}"` : taxonomy?.name || "Products";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (mode === "category" && slug && LEGACY_CATEGORY_SLUGS[slug]) {
    return <Navigate to={categoryHref(LEGACY_CATEGORY_SLUGS[slug])} replace />;
  }

  if ((mode === "category" || mode === "collection") && !loading && !taxonomy && !error) {
    return (
      <>
        <SEO title="Page not found" canonicalPath="/404" />
        <ErrorState message="This page could not be found." />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <SEO title={heading} description={listingSeoDescription(heading, taxonomy?.description)} canonicalPath={mode === "search" ? "/search" : `/${mode}/${slug || ""}${mode === "category" ? "/all" : ""}`} />
      <h1 className="mb-1 font-serif text-3xl font-semibold text-stone-900">{heading}</h1>
      {taxonomy?.description && <p className="mb-6 max-w-2xl text-sm text-stone-500">{taxonomy.description}</p>}
      {mode === "search" && !query && <p className="mb-6 text-sm text-stone-500">Type a search term to find products.</p>}

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <aside className="hidden md:block">
          <FilterPanel filters={filters} availableColors={availableColors} availableSizes={availableSizes} onChange={setFilters} />
        </aside>

        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-stone-500">{total} products</p>
            <SortDropdown value={filters.sort} onChange={(sort) => setFilters((f) => ({ ...f, sort, page: 1 }))} />
          </div>

          <div className="mb-4 md:hidden">
            <details className="rounded-lg border border-stone-200 p-3">
              <summary className="cursor-pointer text-sm font-medium">Filters</summary>
              <div className="mt-3">
                <FilterPanel filters={filters} availableColors={availableColors} availableSizes={availableSizes} onChange={setFilters} />
              </div>
            </details>
          </div>

          {loading && <LoadingState label="Loading products…" />}
          {error && <ErrorState message={error} onRetry={load} />}
          {!loading && !error && mode === "collection" && total === 0 && (
            <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-16 text-center">
              <p className="text-xs font-semibold tracking-[0.3em] text-amber-800/80">{(taxonomy?.name || "").toUpperCase()}</p>
              <h2 className="mt-2 font-serif text-3xl font-bold text-stone-900">Coming Soon</h2>
              <p className="mt-2 text-sm text-stone-500">New styles are on their way. Please check back soon.</p>
            </div>
          )}
          {!loading && !error && !(mode === "collection" && total === 0) && <ProductGrid products={products} byVariant />}

          {!loading && !error && totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setFilters((f) => ({ ...f, page: p }))}
                  className={`h-9 w-9 rounded-full text-sm ${
                    (filters.page || 1) === p ? "bg-rose-900 text-white" : "border border-stone-300 text-stone-600"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
