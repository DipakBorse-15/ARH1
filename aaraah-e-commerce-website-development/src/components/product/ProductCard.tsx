import { thumbUrl } from "@/lib/thumb";
import { WishlistButton } from "@/components/product/WishlistButton";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PriceDisplay } from "./PriceDisplay";
import type { ProductVariant, ProductWithVariants } from "@/types";
import { mainColorKey, mainColorLabel } from "@/lib/mainColor";
import { ratingFor, useRatingSummary } from "@/services/ratings";

// Must match colorSlug() on the product page, otherwise multi-word colours
// ("Royal Blue") never match and the page falls back to the first colour.
function colorSlug(color: string | null) {
  return (color || "").toLowerCase().trim().replace(/\s+/g, "-");
}

/**
 * Renders one colour as its own tile. `variant` selects which colour of the
 * (possibly multi-colour) product this card represents — pass it explicitly
 * when flattening a product's variants into individual grid cards.
 */
export function ProductCard({ product, variant }: { product: ProductWithVariants; variant?: ProductVariant }) {
  const [loaded, setLoaded] = useState(false);
  const summary = useRatingSummary();
  const activeVariants = product.variants.filter((v) => v.active);
  const shown = variant ?? activeVariants[0];
  if (!shown) return null;

  const image = shown.images?.[0];
  const inStock = shown.is_available && shown.stock_quantity > 0;
  // The card shows the MAIN colour only; variation colours (maroon, wine ...) appear on the product page.
  const shownKey = mainColorKey(shown);
  const mainLabel = mainColorLabel(shown);
  const otherColourCount = new Set(activeVariants.map(mainColorKey)).size - 1;
  const rating = ratingFor(
    summary,
    product.id,
    activeVariants.filter((v) => mainColorKey(v) === shownKey).map((v) => v.id)
  );

  return (
    <Link
      to={`/products/${product.slug}${shown.color ? `?variant=${encodeURIComponent(colorSlug(shown.color))}` : ""}`}
      className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all duration-300 hover:-translate-y-3 hover:scale-[1.03] hover:border-rose-900 hover:shadow-2xl hover:shadow-rose-900/40"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-stone-100">
        {image ? (
          <>
            {!loaded && <div className="absolute inset-0 animate-shimmer" />}
            <img
              src={thumbUrl(image)}
              alt={image.alt_text || product.name}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-110 ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-300">No Image</div>
        )}
        {!inStock && (
          <span className="absolute left-2 top-2 rounded-full bg-stone-900/90 px-2.5 py-1 text-[11px] font-medium text-white">
            Out of stock
          </span>
        )}
        <WishlistButton variantId={shown.id} className="absolute bottom-2 right-2" />
        {product.collection?.name && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-rose-900">
            {product.collection.name}
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-3 leading-tight">
        <h3 className="truncate text-sm font-medium leading-snug text-stone-800" title={product.name}>
          {product.name}
        </h3>
        {(mainLabel || otherColourCount > 0 || rating !== null) && (
          <p className="flex items-center justify-between gap-2 text-xs text-stone-500">
            <span className="min-w-0 truncate">
              {mainLabel}
              {otherColourCount > 0 && (
                <span className="text-stone-400">
                  {mainLabel ? " " : ""}(+{otherColourCount} Color{otherColourCount > 1 ? "s" : ""})
                </span>
              )}
            </span>
            {rating !== null && (
              <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-stone-700" title={`${rating.toFixed(1)} out of 5`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#d97706" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {rating.toFixed(1)}
              </span>
            )}
          </p>
        )}
        <div className="pt-0.5 text-sm">
          <PriceDisplay variant={shown} size="sm" />
        </div>
      </div>
    </Link>
  );
}
