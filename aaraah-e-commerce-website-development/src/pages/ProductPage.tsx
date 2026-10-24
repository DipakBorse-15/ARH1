import { WishlistButton } from "@/components/product/WishlistButton";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { fetchProductBySlug, fetchSimilarVariants, fetchSlugForOldSlug, type SimilarItem } from "@/services/products";
import { colorSlug } from "@/lib/slugs";
import { variantSeoDescription, variantSeoTitle } from "@/lib/seoText";
import { friendlyError } from "@/lib/supabase";
import { siteConfig } from "@/config/site";
import { deliveryWindowText } from "@/lib/delivery";
import { categoryHref } from "@/lib/categoryLinks";
import { ReviewsSection, Stars, useReviews } from "@/components/product/ReviewsSection";
import type { ProductVariant, ProductWithVariants } from "@/types";

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M6 6h15l-1.5 9h-12z" />
      <path d="M6 6 5 3H2" />
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01zM12.04 20.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.23 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
    </svg>
  );
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
  const rv = useReviews(product?.id);

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
        // An older web address of a product whose address was shortened: send the visitor to the new one.
        const newSlug = await fetchSlugForOldSlug(slug).catch(() => null);
        if (newSlug && newSlug !== slug) {
          navigate(`/products/${newSlug}${window.location.search}`, { replace: true });
          return;
        }
        setProduct(null);
        return;
      }
      setProduct(data);
      const activeVariants = data.variants.filter((v) => v.active);
      const requested = searchParams.get("variant");
      const match = requested ? activeVariants.find((v) => colorSlug(v.color) === colorSlug(requested)) : null;
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

  // Same product, different ?variant= (e.g. a "similar" colour tile, or the
  // browser back button): load() only runs when the slug changes, so follow
  // the URL here.
  const variantParam = searchParams.get("variant");
  useEffect(() => {
    if (!product || !variantParam) return;
    const match = product.variants.find((v) => v.active && colorSlug(v.color) === colorSlug(variantParam));
    if (match && match.id !== selectedVariant?.id) {
      setSelectedVariant(match);
      setQuantity(1);
      fetchSimilarVariants(match.id).then(setSimilar).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantParam, product]);

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
  if (!product || !selectedVariant)
    return (
      <>
        <SEO title="Product not found" canonicalPath="/404" />
        <ErrorState message="Product not found." />
      </>
    );

  // "Direct Purchase": opens WhatsApp with a ready message naming the exact product,
  // SKU, colour, quantity, price and page link. No login needed; order is handled manually.
  const sellingPrice = selectedVariant.sale_price != null && selectedVariant.sale_price < selectedVariant.price ? selectedVariant.sale_price : selectedVariant.price;
  const waMessage = [
    "Namaste AARAAH! Mujhe ye product kharidna hai:",
    "",
    `Product: ${product.name}`,
    `SKU: ${selectedVariant.sku}`,
    selectedVariant.color ? `Colour: ${selectedVariant.color}` : "",
    `Quantity: ${quantity}`,
    `Price: ${formatINR(sellingPrice)}`,
    `${siteConfig.url}/products/${product.slug}${selectedVariant.color ? `?variant=${encodeURIComponent(colorSlug(selectedVariant.color))}` : ""}`,
    "",
    "Kripya order process batayein.",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");
  const waHref = `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(waMessage)}`;

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
      navigate("/login", {
        state: {
          from: "/checkout",
          directItem: { variant_id: selectedVariant.id, quantity, product, variant: selectedVariant },
        },
      });
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

  // Every colour has its own address (and canonical): /products/<slug>?variant=<colour>
  const variantPath = `/products/${product.slug}${selectedVariant.color ? `?variant=${encodeURIComponent(colorSlug(selectedVariant.color))}` : ""}`;

  return (
    <div className="mx-auto w-full max-w-7xl overflow-x-clip px-4 py-8 sm:px-6">
      <SEO
        title={variantSeoTitle(product, selectedVariant)}
        description={variantSeoDescription(product, selectedVariant)}
        ogType="product"
        image={selectedVariant.images?.[0]?.url}
        canonicalPath={variantPath}
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Product",
              name: product.name,
              brand: { "@type": "Brand", name: product.brand },
              sku: selectedVariant.sku,
              color: selectedVariant.color || undefined,
              description: activeDescription || undefined,
              image: (selectedVariant.images || []).map((i) => i.url).slice(0, 5),
              url: `${siteConfig.url}${variantPath}`,
              ...(rv.count > 0
                ? {
                    aggregateRating: { "@type": "AggregateRating", ratingValue: Number(rv.average.toFixed(1)), reviewCount: rv.count },
                    review: rv.reviews.slice(0, 5).map((r) => ({
                      "@type": "Review",
                      reviewRating: { "@type": "Rating", ratingValue: r.rating },
                      author: { "@type": "Person", name: r.reviewer_name },
                      reviewBody: r.body,
                      datePublished: r.created_at.slice(0, 10),
                    })),
                  }
                : {}),
              offers: {
                "@type": "Offer",
                priceCurrency: "INR",
                price: sellingPrice,
                url: `${siteConfig.url}${variantPath}`,
                availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                itemCondition: "https://schema.org/NewCondition",
                seller: { "@type": "Organization", name: siteConfig.name },
                // Same promises as the Shipping Policy and Returns pages.
                shippingDetails: {
                  "@type": "OfferShippingDetails",
                  shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "INR" },
                  shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
                  deliveryTime: {
                    "@type": "ShippingDeliveryTime",
                    handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
                    transitTime: { "@type": "QuantitativeValue", minValue: 5, maxValue: 7, unitCode: "DAY" },
                  },
                },
                hasMerchantReturnPolicy: {
                  "@type": "MerchantReturnPolicy",
                  applicableCountry: "IN",
                  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
                  merchantReturnDays: 7,
                },
              },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
                ...(product.category
                  ? [{ "@type": "ListItem", position: 2, name: product.category.name, item: `${siteConfig.url}${categoryHref(product.category.slug)}` }]
                  : []),
                { "@type": "ListItem", position: product.category ? 3 : 2, name: product.name },
              ],
            },
          ],
        }}
      />

      {/* key={product.id}: one quiet entrance per product visited — switching
          colour on the SAME product should not replay it. */}
      <div key={product.id} className="grid animate-fade-rise-in grid-cols-1 items-start gap-8 md:grid-cols-2 md:gap-10">
        <div className="min-w-0 md:sticky md:top-20 md:self-start">
          <ProductGallery images={selectedVariant.images || []} alt={`${product.name} - ${selectedVariant.color}`} />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-900/70">{product.brand}</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="min-w-0 break-words text-2xl font-semibold text-stone-900 sm:text-3xl">{product.name}</h1>
            <WishlistButton variantId={selectedVariant.id} className="flex-shrink-0 border border-stone-200" />
          </div>
          <p className="mt-1 text-xs text-stone-400">SKU: {selectedVariant.sku}</p>
          {rv.count > 0 && (
            <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm text-stone-600 hover:text-rose-900">
              <Stars value={rv.average} />
              <span className="font-medium">{rv.average.toFixed(1)}</span>
              <span className="text-stone-400">({rv.count})</span>
            </a>
          )}

          <div className="mt-4">
            <PriceDisplay variant={selectedVariant} size="lg" />
          </div>

          <p className={`mt-2 text-sm font-medium ${inStock ? "text-emerald-600" : "text-rose-600"}`}>
            {inStock ? `In stock (${selectedVariant.stock_quantity} left)` : "Out of stock"}
          </p>

          {inStock && (
            <div className="mt-3 rounded-lg bg-stone-50 p-3 text-xs text-stone-600">
              <p>
                <span className="font-semibold text-stone-800">Estimated delivery: {deliveryWindowText()}</span> · Free shipping
              </p>
              <p className="mt-0.5">
                Dispatched in 1–3 working days after payment is confirmed.{" "}
                <Link to="/returns-and-refunds" className="text-rose-900 underline">
                  7-day return for damaged or wrong items
                </Link>
              </p>
            </div>
          )}

          <div className="mt-6">
            <VariantSelector variants={product.variants} selectedId={selectedVariant.id} onSelect={selectVariant} />
          </div>

          {inStock && (
            <div className="mt-6 flex items-center gap-4">
              <p className="text-sm font-medium text-stone-700">Quantity</p>
              <QuantitySelector quantity={quantity} onChange={setQuantity} max={maxQty || 1} />
            </div>
          )}

          {/* Web: 3 buttons in one row. Mobile: Add to Cart + Buy Now on top, Direct Purchase below. */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <button
              onClick={handleAddToCart}
              disabled={!inStock || busy}
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-rose-900 px-3 py-3 text-sm font-semibold text-rose-900 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CartIcon />
              Add to Cart
            </button>
            <button
              onClick={handleBuyNow}
              disabled={!inStock || busy}
              className="flex items-center justify-center whitespace-nowrap rounded-full border-2 border-rose-900 bg-rose-900 px-3 py-3 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Buy Now
            </button>
            {inStock ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-2 flex items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-[#bfdcc6] bg-[#e8f4ea] px-3 py-3 text-sm font-semibold text-[#1d7a39] transition hover:bg-[#d9eddd] sm:col-span-1"
              >
                <WhatsAppIcon />
                Direct Purchase
              </a>
            ) : (
              <span
                aria-disabled="true"
                className="col-span-2 flex cursor-not-allowed items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-[#bfdcc6] bg-[#e8f4ea] px-3 py-3 text-sm font-semibold text-[#1d7a39] opacity-40 sm:col-span-1"
              >
                <WhatsAppIcon />
                Direct Purchase
              </span>
            )}
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

      <ReviewsSection productId={product.id} reviews={rv.reviews} average={rv.average} onChanged={rv.reload} />

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-serif text-2xl font-semibold text-stone-900">You may also like</h2>
          <ProductGrid items={similar} />
        </section>
      )}
    </div>
  );
}
