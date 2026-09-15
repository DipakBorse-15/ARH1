import { Link } from "react-router-dom";
import { PriceDisplay } from "./PriceDisplay";
import type { ProductVariant, ProductWithVariants } from "@/types";

/**
 * Renders one colour as its own tile. `variant` selects which colour of the
 * (possibly multi-colour) product this card represents — pass it explicitly
 * when flattening a product's variants into individual grid cards.
 */
export function ProductCard({ product, variant }: { product: ProductWithVariants; variant?: ProductVariant }) {
  const activeVariants = product.variants.filter((v) => v.active);
  const shown = variant ?? activeVariants[0];
  if (!shown) return null;

  const image = shown.images?.[0];
  const inStock = shown.is_available && shown.stock_quantity > 0;
  const otherColourCount = activeVariants.length - 1;

  return (
    <Link
      to={`/products/${product.slug}${shown.color ? `?variant=${encodeURIComponent(shown.color.toLowerCase())}` : ""}`}
      className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:shadow-lg hover:shadow-stone-200"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-stone-100">
        {image ? (
          <img
            src={image.url}
            alt={image.alt_text || product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-300">No Image</div>
        )}
        {!inStock && (
          <span className="absolute left-2 top-2 rounded-full bg-stone-900/90 px-2.5 py-1 text-[11px] font-medium text-white">
            Out of stock
          </span>
        )}
        {product.collection?.name && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-rose-900">
            {product.collection.name}
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-900/70">{product.brand}</p>
        <h3 className="truncate text-sm font-medium text-stone-800" title={product.name}>
          {product.name}
        </h3>
        {shown.color && <p className="text-xs text-stone-500">{shown.color}</p>}
        <div className="text-sm">
          <PriceDisplay variant={shown} size="sm" />
        </div>
        {otherColourCount > 0 && (
          <p className="pt-0.5 text-[11px] text-stone-400">+{otherColourCount} more colour{otherColourCount > 1 ? "s" : ""}</p>
        )}
      </div>
    </Link>
  );
}
