import { siteConfig } from "@/config/site";
import type { ProductVariant } from "@/types";

export function formatINR(amount: number): string {
  return `${siteConfig.currencySymbol}${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function PriceDisplay({ variant, size = "md" }: { variant: ProductVariant; size?: "sm" | "md" | "lg" }) {
  const hasSale = variant.sale_price != null && variant.sale_price < variant.price;
  const discount = hasSale ? Math.round(((variant.price - (variant.sale_price as number)) / variant.price) * 100) : 0;

  const priceClass = size === "lg" ? "text-2xl md:text-3xl" : size === "sm" ? "text-sm" : "text-lg";
  const mrpClass = size === "lg" ? "text-base" : "text-xs";

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className={`font-semibold text-stone-900 ${priceClass}`}>{formatINR(hasSale ? (variant.sale_price as number) : variant.price)}</span>
      {hasSale && (
        <>
          <span className={`text-stone-400 line-through ${mrpClass}`}>{formatINR(variant.price)}</span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{discount}% off</span>
        </>
      )}
    </div>
  );
}
