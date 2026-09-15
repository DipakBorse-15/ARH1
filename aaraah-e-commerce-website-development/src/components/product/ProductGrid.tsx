import { ProductCard } from "./ProductCard";
import { EmptyState } from "@/components/ui/States";
import type { ProductVariant, ProductWithVariants } from "@/types";

export function ProductGrid({
  products,
  items,
  emptyMessage,
  byVariant = false,
}: {
  products?: ProductWithVariants[];
  /** Pre-flattened (product, variant) pairs — e.g. cross-product recommendations. Takes priority over `products`. */
  items?: { product: ProductWithVariants; variant: ProductVariant }[];
  emptyMessage?: string;
  /** When true, every active colour of `products` gets its own tile instead of one tile per product. */
  byVariant?: boolean;
}) {
  const cards = items
    ? items.map((it) => ({ key: it.variant.id, product: it.product, variant: it.variant }))
    : byVariant
      ? (products || []).flatMap((p) => p.variants.filter((v) => v.active).map((v) => ({ key: v.id, product: p, variant: v })))
      : (products || []).map((p) => ({ key: p.id, product: p, variant: undefined }));

  if (!cards.length) {
    return <EmptyState title="No products found" message={emptyMessage || "Try adjusting your filters or check back soon."} />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {cards.map((c) => (
        <ProductCard key={c.key} product={c.product} variant={c.variant} />
      ))}
    </div>
  );
}
