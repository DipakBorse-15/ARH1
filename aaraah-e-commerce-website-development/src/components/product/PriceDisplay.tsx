import { siteConfig } from "@/config/site";
import type { ProductVariant } from "@/types";

export function formatINR(amount: number): string {
  return `${siteConfig.currencySymbol}${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function PriceDisplay({ variant, size = "md" }: { variant: ProductVariant; size?: "sm" | "md" | "lg" }) {
  const hasSale = variant.sale_price != null && variant.sale_price < variant.price;
  const sellingPrice = hasSale ? (variant.sale_price as number) : variant.price;

  // The listing sheet can supply an exact discount % / amount (data-entry controlled,
  // e.g. rounded for marketing). Prefer that; fall back to the computed value.
  const discountPercent = hasSale
    ? variant.discount_percent != null
      ? Math.round(variant.discount_percent * 100)
      : Math.round(((variant.price - sellingPrice) / variant.price) * 100)
    : 0;
  const savedAmount = hasSale
    ? variant.discount_amount != null
      ? variant.discount_amount
      : variant.price - sellingPrice
    : 0;

  const priceClass = size === "lg" ? "text-2xl md:text-3xl" : size === "sm" ? "text-sm" : "text-lg";
  const mrpClass = size === "lg" ? "text-base" : "text-xs";

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={`font-semibold text-stone-900 ${priceClass}`}>{formatINR(sellingPrice)}</span>
        {hasSale && (
          <>
            <span className={`text-stone-400 line-through ${mrpClass}`}>{formatINR(variant.price)}</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {discountPercent}% off
            </span>
          </>
        )}
      </div>
      {hasSale && savedAmount > 0 && (
        <p className="mt-0.5 text-xs text-emerald-700">You save {formatINR(savedAmount)}</p>
      )}
    </div>
  );
}
