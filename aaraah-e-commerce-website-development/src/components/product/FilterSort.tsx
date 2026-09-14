import type { ProductFilters } from "@/services/products";

const PRICE_RANGES: { label: string; min?: number; max?: number }[] = [
  { label: "All prices" },
  { label: "Under ₹1,000", max: 999 },
  { label: "₹1,000 – ₹3,000", min: 1000, max: 3000 },
  { label: "₹3,000 – ₹5,000", min: 3000, max: 5000 },
  { label: "Above ₹5,000", min: 5000 },
];

export function FilterPanel({
  filters,
  availableColors,
  onChange,
}: {
  filters: ProductFilters;
  availableColors: string[];
  onChange: (next: ProductFilters) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-900">Price</h3>
        <div className="space-y-1.5">
          {PRICE_RANGES.map((r) => {
            const isActive = filters.minPrice === r.min && filters.maxPrice === r.max;
            return (
              <button
                key={r.label}
                onClick={() => onChange({ ...filters, minPrice: r.min, maxPrice: r.max, page: 1 })}
                className={`block w-full rounded-md px-2 py-1.5 text-left text-sm transition ${
                  isActive ? "bg-rose-900 text-white" : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {availableColors.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-stone-900">Colour</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onChange({ ...filters, color: undefined, page: 1 })}
              className={`rounded-full border px-3 py-1 text-xs ${
                !filters.color ? "border-rose-900 bg-rose-900 text-white" : "border-stone-300 text-stone-600"
              }`}
            >
              All
            </button>
            {availableColors.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ ...filters, color: c, page: 1 })}
                className={`rounded-full border px-3 py-1 text-xs ${
                  filters.color === c ? "border-rose-900 bg-rose-900 text-white" : "border-stone-300 text-stone-600"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          checked={!!filters.inStockOnly}
          onChange={(e) => onChange({ ...filters, inStockOnly: e.target.checked, page: 1 })}
          className="h-4 w-4 rounded border-stone-300 text-rose-900 focus:ring-rose-900"
        />
        In stock only
      </label>
    </div>
  );
}

export function SortDropdown({ value, onChange }: { value: ProductFilters["sort"]; onChange: (v: ProductFilters["sort"]) => void }) {
  return (
    <select
      aria-label="Sort products"
      value={value || "newest"}
      onChange={(e) => onChange(e.target.value as ProductFilters["sort"])}
      className="rounded-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:border-rose-900 focus:outline-none"
    >
      <option value="newest">Newest</option>
      <option value="price-asc">Price: Low to High</option>
      <option value="price-desc">Price: High to Low</option>
    </select>
  );
}
