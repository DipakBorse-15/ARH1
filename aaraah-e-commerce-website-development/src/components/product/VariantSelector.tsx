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

      <div className="flex flex-wrap gap-2">
        {visible.map((v) => {
          const isSelected = v.id === selectedId;
          const outOfStock = !v.is_available || v.stock_quantity <= 0;
          const thumb = v.images?.[0]?.url;

          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v)}
              aria-pressed={isSelected}
              title={`${v.color}${outOfStock ? " (out of stock)" : ""}`}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                isSelected ? "border-rose-900" : "border-stone-200 hover:border-rose-900/60"
              } ${outOfStock ? "opacity-50" : ""}`}
            >
              {thumb ? (
                <img src={thumb} alt={v.color || "Variant"} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="absolute inset-0" style={{ backgroundColor: v.color_hex || "#ddd" }} />
              )}
              {outOfStock && (
                <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[8px] font-medium text-white">
                  Sold out
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
