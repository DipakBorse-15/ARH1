import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { ProductGrid } from "@/components/product/ProductGrid";
import { FilterPanel, SortDropdown } from "@/components/product/FilterSort";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { fetchCategoryBySlug } from "@/services/categories";
import { fetchCollectionBySlug } from "@/services/collections";
import { fetchProducts, type ProductFilters } from "@/services/products";
import { friendlyError } from "@/lib/supabase";
import type { Category, Collection, ProductWithVariants } from "@/types";

type Mode = "category" | "collection" | "search";

const PAGE_SIZE = 12;

export function ProductListingPage({ mode }: { mode: Mode }) {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";

  const [taxonomy, setTaxonomy] = useState<Category | Collection | null>(null);
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProductFilters>({ sort: "newest", page: 1, pageSize: PAGE_SIZE });

  useEffect(() => {
    setFilters({ sort: "newest", page: 1, pageSize: PAGE_SIZE });
  }, [mode, slug, query]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, slug, query, filters]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (mode === "category" && slug) {
        const cat = await fetchCategoryBySlug(slug);
        setTaxonomy(cat);
        if (!cat) {
          setProducts([]);
          setTotal(0);
          return;
        }
        const res = await fetchProducts({ ...filters, categorySlug: slug });
        setProducts(res.products);
        setTotal(res.total);
      } else if (mode === "collection" && slug) {
        const col = await fetchCollectionBySlug(slug);
        setTaxonomy(col);
        if (!col) {
          setProducts([]);
          setTotal(0);
          return;
        }
        const res = await fetchProducts({ ...filters, collectionSlug: slug });
        setProducts(res.products);
        setTotal(res.total);
      } else {
        const res = await fetchProducts({ ...filters, search: query });
        setProducts(res.products);
        setTotal(res.total);
      }
    } catch (err) {
      setError(friendlyError(err, "Could not load products."));
    } finally {
      setLoading(false);
    }
  }

  const availableColors = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.variants.forEach((v) => v.color && v.active && set.add(v.color)));
    return Array.from(set);
  }, [products]);

  const heading = mode === "search" ? `Search results for "${query}"` : taxonomy?.name || "Products";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if ((mode === "category" || mode === "collection") && !loading && !taxonomy && !error) {
    return <ErrorState message="This page could not be found." />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <SEO title={heading} description={taxonomy?.description || `Shop ${heading} at AARAAH.`} canonicalPath={`/${mode}/${slug || ""}`} />
      <h1 className="mb-1 font-serif text-3xl font-semibold text-stone-900">{heading}</h1>
      {taxonomy?.description && <p className="mb-6 max-w-2xl text-sm text-stone-500">{taxonomy.description}</p>}
      {mode === "search" && !query && <p className="mb-6 text-sm text-stone-500">Type a search term to find products.</p>}

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <aside className="hidden md:block">
          <FilterPanel filters={filters} availableColors={availableColors} onChange={setFilters} />
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
                <FilterPanel filters={filters} availableColors={availableColors} onChange={setFilters} />
              </div>
            </details>
          </div>

          {loading && <LoadingState label="Loading products…" />}
          {error && <ErrorState message={error} onRetry={load} />}
          {!loading && !error && <ProductGrid products={products} byVariant />}

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
