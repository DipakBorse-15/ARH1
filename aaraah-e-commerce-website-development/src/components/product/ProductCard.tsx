import { Link } from "react-router-dom";
import { PriceDisplay } from "./PriceDisplay";
import { productColors, productMinPrice } from "@/services/products";
import type { ProductWithVariants } from "@/types";

export function ProductCard({ product }: { product: ProductWithVariants }) {
  const activeVariants = product.variants.filter((v) => v.active);
  const primary = activeVariants[0];
  if (!primary) return null;

  const image = primary.images?.[0];
  const colors = productColors(product);
  const inStock = activeVariants.some((v) => v.is_available && v.stock_quantity > 0);
  const minPrice = productMinPrice(product);

  return (
    <Link
      to={`/products/${product.slug}${primary.color ? `?variant=${encodeURIComponent(primary.color.toLowerCase())}` : ""}`}
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
        <div className="text-sm">
          <PriceDisplay variant={{ ...primary, price: minPrice, sale_price: null }} size="sm" />
        </div>
        {colors.length > 1 && (
          <div className="flex items-center gap-1 pt-1">
            {colors.slice(0, 5).map((c) => (
              <span
                key={c.color}
                title={c.color}
                className="h-3.5 w-3.5 rounded-full border border-stone-300"
                style={{ backgroundColor: c.hex || "#ccc" }}
              />
            ))}
            {colors.length > 5 && <span className="text-[11px] text-stone-400">+{colors.length - 5}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
