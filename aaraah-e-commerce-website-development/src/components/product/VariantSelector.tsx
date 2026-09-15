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

  const selected = visible.find((v) => v.id === selectedId);

  return (
    <div>
      <p className="mb-2 text-sm text-stone-600">
        Colour: <span className="font-semibold text-stone-900">{selected?.color}</span>
      </p>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {visible.map((v) => {
          const isSelected = v.id === selectedId;
          const outOfStock = !v.is_available || v.stock_quantity <= 0;
          const thumb = v.images?.[0]?.url;
          const mrp = Number(v.price);
          const sale = v.sale_price == null ? null : Number(v.sale_price);
          const now = sale ?? mrp;

          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v)}
              aria-pressed={isSelected}
              title={`${v.color}${outOfStock ? " (out of stock)" : ""}`}
              className={`group overflow-hidden rounded-lg border bg-white text-left transition ${
                isSelected
                  ? "border-rose-900 ring-2 ring-rose-900/30"
                  : "border-stone-200 hover:border-rose-900/60"
              } ${outOfStock ? "opacity-50" : ""}`}
            >
              <div className="relative aspect-[3/4] w-full bg-stone-100">
                {thumb ? (
                  <img src={thumb} alt={v.color || "Variant"} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-0" style={{ backgroundColor: v.color_hex || "#ddd" }} />
                )}
                {outOfStock && (
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[9px] font-medium text-white">
                    Sold out
                  </span>
                )}
              </div>

              <div className="px-1.5 py-1">
                <p className="truncate text-[11px] text-stone-600">{v.color}</p>
                <p className="text-[11px] font-semibold text-stone-900">{formatINR(now)}</p>
                {sale != null && sale < mrp && (
                  <p className="text-[10px] text-stone-400 line-through">{formatINR(mrp)}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
