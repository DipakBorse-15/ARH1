import { Link } from "react-router-dom";
import { QuantitySelector } from "@/components/product/QuantitySelector";
import { formatINR } from "@/components/product/PriceDisplay";
import { effectivePrice } from "@/services/products";
import { useCart } from "@/contexts/CartContext";
import type { CartItem } from "@/types";

export function CartItemRow({ item }: { item: CartItem }) {
  const { increment, decrement, removeItem } = useCart();
  const variant = item.variant;
  if (!variant) return null;

  const image = variant.images?.[0];
  const price = effectivePrice(variant);
  const product = variant.product;

  return (
    <div className="flex gap-4 border-b border-stone-200 py-4">
      <Link to={product ? `/products/${product.slug}` : "#"} className="h-24 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100">
        {image ? <img src={image.url} alt={image.alt_text || ""} className="h-full w-full object-cover" /> : null}
      </Link>
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <p className="text-sm font-medium text-stone-900">{product?.name || "Product"}</p>
          <p className="text-xs text-stone-500">
            Colour: {variant.color} · SKU: {variant.sku}
          </p>
          <p className="mt-1 text-sm font-semibold text-stone-900">{formatINR(price)}</p>
        </div>
        <div className="flex items-center justify-between">
          <QuantitySelector
            quantity={item.quantity}
            max={variant.stock_quantity}
            onChange={(q) => (q > item.quantity ? increment(item) : decrement(item))}
          />
          <button onClick={() => removeItem(item)} className="text-xs font-medium text-rose-700 hover:underline">
            Remove
          </button>
        </div>
      </div>
      <p className="hidden w-20 flex-shrink-0 text-right text-sm font-semibold text-stone-900 sm:block">
        {formatINR(price * item.quantity)}
      </p>
    </div>
  );
}
