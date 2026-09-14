import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { ProductGrid } from "@/components/product/ProductGrid";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { siteConfig, isSupabaseConfigured } from "@/config/site";
import { fetchCategories } from "@/services/categories";
import { fetchCollections } from "@/services/collections";
import { fetchProducts } from "@/services/products";
import { friendlyError } from "@/lib/supabase";
import type { Category, Collection, ProductWithVariants } from "@/types";

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [newArrivals, setNewArrivals] = useState<ProductWithVariants[]>([]);
  const [festive, setFestive] = useState<ProductWithVariants[]>([]);
  const [daily, setDaily] = useState<ProductWithVariants[]>([]);
  const [occasional, setOccasional] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [cats, cols] = await Promise.all([fetchCategories(), fetchCollections()]);
      setCategories(cats);
      setCollections(cols);

      const [na, fe, dw, oc] = await Promise.all([
        fetchProducts({ collectionSlug: "new-arrival", pageSize: 8 }),
        fetchProducts({ collectionSlug: "festive", pageSize: 8 }),
        fetchProducts({ collectionSlug: "daily-wear", pageSize: 8 }),
        fetchProducts({ collectionSlug: "occasional", pageSize: 8 }),
      ]);
      setNewArrivals(na.products);
      setFestive(fe.products);
      setDaily(dw.products);
      setOccasional(oc.products);
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
          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
            <h2 className="mb-6 font-serif text-2xl font-semibold text-stone-900">Shop by Category</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {categories.map((c) => (
                <Link key={c.id} to={`/category/${c.slug}`} className="group overflow-hidden rounded-2xl border border-stone-200">
                  <div className="flex aspect-square items-center justify-center bg-stone-100 text-stone-300 overflow-hidden">
                    {c.image ? (
                      <img src={c.image} alt={c.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <span className="text-3xl">🪷</span>
                    )}
                  </div>
                  <p className="p-3 text-center text-sm font-medium text-stone-800">{c.name}</p>
                </Link>
              ))}
            </div>
          </section>

          <FeaturedCollectionsStrip collections={collections} />

          <ProductSection title="New Arrivals" viewAllHref="/collection/new-arrival" products={newArrivals} />
          <ProductSection title="Festive Collection" viewAllHref="/collection/festive" products={festive} />
          <ProductSection title="Daily Wear" viewAllHref="/collection/daily-wear" products={daily} />
          <ProductSection title="Occasional Wear" viewAllHref="/collection/occasional" products={occasional} />

          <TrustSection />
        </>
      )}
    </div>
  );
}

function FeaturedCollectionsStrip({ collections }: { collections: Collection[] }) {
  if (!collections.length) return null;
  return (
    <section className="bg-stone-50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="mb-6 font-serif text-2xl font-semibold text-stone-900">Featured Collections</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {collections.map((c) => (
            <Link
              key={c.id}
              to={`/collection/${c.slug}`}
              className="relative flex h-32 items-end overflow-hidden rounded-2xl bg-gradient-to-br from-rose-900 to-amber-700 p-4 text-white"
            >
              {c.image && <img src={c.image} alt={c.name} className="absolute inset-0 h-full w-full object-cover opacity-70" />}
              <span className="relative font-serif text-lg font-semibold">{c.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductSection({ title, viewAllHref, products }: { title: string; viewAllHref: string; products: ProductWithVariants[] }) {
  if (!products.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-serif text-2xl font-semibold text-stone-900">{title}</h2>
        <Link to={viewAllHref} className="text-sm font-medium text-rose-900 hover:underline">
          View all →
        </Link>
      </div>
      <ProductGrid products={products} />
    </section>
  );
}

function TrustSection() {
  const items = [
    { icon: "🚚", title: "Pan-India Delivery", desc: "Fast, reliable shipping to every state." },
    { icon: "🔒", title: "Secure Payments", desc: "Your transactions are safe & encrypted." },
    { icon: "↩️", title: "Easy Returns", desc: "Hassle-free returns on eligible items." },
    { icon: "🧵", title: "Quality Fabrics", desc: "Curated craftsmanship you can trust." },
  ];
  return (
    <section className="border-t border-stone-200 bg-stone-50 py-12">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 sm:px-6 md:grid-cols-4">
        {items.map((it) => (
          <div key={it.title} className="text-center">
            <div className="mb-2 text-3xl">{it.icon}</div>
            <h3 className="text-sm font-semibold text-stone-900">{it.title}</h3>
            <p className="mt-1 text-xs text-stone-500">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
