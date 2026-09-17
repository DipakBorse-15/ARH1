import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { ProductGallery } from "@/components/product/ProductGallery";
import { VariantSelector } from "@/components/product/VariantSelector";
import { PriceDisplay, formatINR } from "@/components/product/PriceDisplay";
import { QuantitySelector } from "@/components/product/QuantitySelector";
import { ProductGrid } from "@/components/product/ProductGrid";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/contexts/ToastContext";
import { fetchProductBySlug, fetchSimilarVariants, type SimilarItem } from "@/services/products";
import { friendlyError } from "@/lib/supabase";
import { siteConfig } from "@/config/site";
import type { ProductVariant, ProductWithVariants } from "@/types";

function colorSlug(color: string | null) {
  return (color || "").toLowerCase().trim().replace(/\s+/g, "-");
}

export default function ProductPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { show } = useToast();

  const [product, setProduct] = useState<ProductWithVariants | null>(null);
  const [similar, setSimilar] = useState<SimilarItem[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function load() {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProductBySlug(slug);
      if (!data) {
        setProduct(null);
        return;
      }
      setProduct(data);
      const activeVariants = data.variants.filter((v) => v.active);
      const requested = searchParams.get("variant");
      const match = requested ? activeVariants.find((v) => colorSlug(v.color) === requested) : null;
      const initialVariant = match || activeVariants[0] || null;
      setSelectedVariant(initialVariant);
      setQuantity(1);
      if (initialVariant) {
        fetchSimilarVariants(initialVariant.id).then(setSimilar).catch(() => {});
      }
    } catch (err) {
      setError(friendlyError(err, "Could not load this product."));
    } finally {
      setLoading(false);
    }
  }

  function selectVariant(v: ProductVariant) {
    setSelectedVariant(v);
    setQuantity(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("variant", colorSlug(v.color));
      return next;
    }, { replace: true });
  }

  // Amazon-style: bullets follow the selected colour. A variant's own bullets win;
  // the parent product's bullets are the fallback for variants that have none.
  const activeBullets = useMemo(() => {
    const variantBullets = selectedVariant?.bullet_points ?? [];
    return variantBullets.length > 0 ? variantBullets : product?.bullet_points ?? [];
  }, [selectedVariant, product]);

  // Description also varies per colour (per the listing sheet); the product's
  // own description is only a fallback for a variant that doesn't set one.
  const activeDescription = selectedVariant?.description || product?.description || "";

  // "Product Details" table: only fields the merchant marked as customer-facing
  // ("Yes" in the listing sheet). Blank fields are simply left out.
  const detailRows = useMemo(() => {
    if (!selectedVariant) return [] as [string, string][];
    const rows: [string, string][] = [];
    if (selectedVariant.work_type) rows.push(["Work Type", selectedVariant.work_type]);
    if (selectedVariant.work_pattern) rows.push(["Work Pattern", selectedVariant.work_pattern]);
    if (selectedVariant.best_for) rows.push(["Best For", selectedVariant.best_for]);
    if (selectedVariant.manufacturer) rows.push(["Manufacturer", selectedVariant.manufacturer]);
    if (selectedVariant.included_components) rows.push(["Included Components", selectedVariant.included_components]);
    return rows;
  }, [selectedVariant]);

  const maxQty = useMemo(() => Math.min(10, selectedVariant?.stock_quantity ?? 0), [selectedVariant]);
  const inStock = !!selectedVariant && selectedVariant.is_available && selectedVariant.stock_quantity > 0;

  if (loading) return <LoadingState label="Loading product…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!product || !selectedVariant) return <ErrorState message="Product not found." />;

  async function handleAddToCart() {
    if (!selectedVariant) return;
    if (!inStock) {
      show("This variant is out of stock.", "error");
      return;
    }
    setBusy(true);
    await addItem(selectedVariant.id, quantity);
    setBusy(false);
  }

  function handleBuyNow() {
    if (!selectedVariant) return;
    if (!inStock) {
      show("This variant is out of stock.", "error");
      return;
    }
    if (!user) {
      show("Please sign in to continue.", "error");
      navigate("/login", { state: { from: window.location.pathname + window.location.search } });
      return;
    }
    navigate("/checkout", {
      state: {
        directItem: {
          variant_id: selectedVariant.id,
          quantity,
          product,
          variant: selectedVariant,
        },
      },
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <SEO
        title={`${product.name} — ${selectedVariant.color || ""}`}
        description={product.description || `${product.name} by ${product.brand}, available at ${siteConfig.name}.`}
        image={selectedVariant.images?.[0]?.url}
        canonicalPath={`/products/${product.slug}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          brand: product.brand,
          sku: selectedVariant.sku,
          description: product.description,
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: selectedVariant.sale_price ?? selectedVariant.price,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        }}
      />

      <div className="grid items-start gap-10 md:grid-cols-2">
        <div className="md:sticky md:top-20 md:self-start">
          <ProductGallery images={selectedVariant.images || []} alt={`${product.name} - ${selectedVariant.color}`} />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-900/70">{product.brand}</p>
          <h1 className="mt-1 text-2xl font-semibold text-stone-900 sm:text-3xl">{product.name}</h1>
          <p className="mt-1 text-xs text-stone-400">SKU: {selectedVariant.sku}</p>

          <div className="mt-4">
            <PriceDisplay variant={selectedVariant} size="lg" />
          </div>

          <p className={`mt-2 text-sm font-medium ${inStock ? "text-emerald-600" : "text-rose-600"}`}>
            {inStock ? `In stock (${selectedVariant.stock_quantity} left)` : "Out of stock"}
          </p>

          <div className="mt-6">
            <VariantSelector variants={product.variants} selectedId={selectedVariant.id} onSelect={selectVariant} />
          </div>

          {inStock && (
            <div className="mt-6 flex items-center gap-4">
              <p className="text-sm font-medium text-stone-700">Quantity</p>
              <QuantitySelector quantity={quantity} onChange={setQuantity} max={maxQty || 1} />
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleAddToCart}
              disabled={!inStock || busy}
              className="flex-1 rounded-full border-2 border-rose-900 px-6 py-3 text-sm font-semibold text-rose-900 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add to Cart
            </button>
            <button
              onClick={handleBuyNow}
              disabled={!inStock || busy}
              className="flex-1 rounded-full bg-rose-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Buy Now
            </button>
          </div>

          {activeBullets.length > 0 && (
            <div className="mt-8 border-t border-stone-200 pt-6">
              <h2 className="mb-2 text-sm font-semibold text-stone-900">About this item</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-stone-600">
                {activeBullets.map((bp, idx) => (
                  <li key={idx}>{bp}</li>
                ))}
              </ul>
            </div>
          )}

          {activeDescription && (
            <div className="mt-6 border-t border-stone-200 pt-6">
              <h2 className="mb-2 text-sm font-semibold text-stone-900">Product Description</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-stone-600">{activeDescription}</p>
            </div>
          )}

          {detailRows.length > 0 && (
            <div className="mt-6 border-t border-stone-200 pt-6">
              <h2 className="mb-2 text-sm font-semibold text-stone-900">Product Details</h2>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {detailRows.map(([label, value]) => (
                  <div key={label} className="flex gap-2">
                    <dt className="text-stone-500">{label}:</dt>
                    <dd className="font-medium text-stone-800">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {selectedVariant.variant_info && (
            <div className="mt-4 rounded-lg bg-stone-50 p-3 text-xs text-stone-500">{selectedVariant.variant_info}</div>
          )}

          <p className="mt-4 text-xs text-stone-400">
            MRP {formatINR(selectedVariant.price)} inclusive of all taxes. Delivery details calculated at checkout.
          </p>
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-serif text-2xl font-semibold text-stone-900">You may also like</h2>
          <ProductGrid items={similar} />
        </section>
      )}
    </div>
  );
}
