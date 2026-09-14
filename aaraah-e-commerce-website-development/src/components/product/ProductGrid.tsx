import { ProductCard } from "./ProductCard";
import { EmptyState } from "@/components/ui/States";
import type { ProductWithVariants } from "@/types";

export function ProductGrid({ products, emptyMessage }: { products: ProductWithVariants[]; emptyMessage?: string }) {
  if (!products.length) {
    return <EmptyState title="No products found" message={emptyMessage || "Try adjusting your filters or check back soon."} />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
