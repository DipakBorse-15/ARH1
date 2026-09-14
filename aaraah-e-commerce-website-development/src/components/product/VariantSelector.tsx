import { formatINR } from "./PriceDisplay";
import type { ProductVariant } from "@/types";

export function VariantSelector({
  variants,
  selectedId,
  onSelect,
}: {
  variants: ProductVariant[];
  selectedId: string;
  onSelect: (variant: ProductVariant) => void;
}) {
  const visible = variants.filter((v) => v.active);
  if (visible.length <= 1) return null;

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-stone-700">
        Colour: <span className="font-semibold text-stone-900">{visible.find((v) => v.id === selectedId)?.color}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {visible.map((v) => {
          const isSelected = v.id === selectedId;
          const outOfStock = !v.is_available || v.stock_quantity <= 0;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v)}
              title={`${v.color}${outOfStock ? " (out of stock)" : ""} — ${formatINR(Number(v.sale_price ?? v.price))}`}
              aria-pressed={isSelected}
              className={`relative flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                isSelected
                  ? "border-rose-900 bg-rose-900 text-white shadow"
                  : "border-stone-300 bg-white text-stone-700 hover:border-rose-900"
              } ${outOfStock ? "opacity-50" : ""}`}
            >
              <span
                className="h-3.5 w-3.5 rounded-full border border-black/10"
                style={{ backgroundColor: v.color_hex || "#ccc" }}
              />
              {v.color}
              {outOfStock && <span className="text-[10px]">(Sold out)</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
