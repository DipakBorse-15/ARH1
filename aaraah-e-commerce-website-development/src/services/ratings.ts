import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Star ratings for the product cards and the "Top Rated" sort.
 * One tiny row per reviewed colour (see migration 0041), never the review texts, remembered for 2 minutes.
 * If it cannot be loaded, cards simply show no rating and Top Rated falls back to Newest.
 */
interface Entry {
  sum: number;
  count: number;
}
export interface RatingSummary {
  /** Reviews of one colour (SKU). */
  byVariant: Map<string, Entry>;
  /** Old reviews that could not be matched to a colour: they count for the whole design. */
  legacy: Map<string, Entry>;
}

const TTL_MS = 2 * 60_000;
let cache: { at: number; data: RatingSummary } | null = null;
let inflight: Promise<RatingSummary> | null = null;

export function loadRatingSummary(): Promise<RatingSummary> {
  if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.data);
  if (!inflight) {
    inflight = (async () => {
      const data: RatingSummary = { byVariant: new Map(), legacy: new Map() };
      try {
        const { data: rows, error } = await supabase.rpc("product_rating_summary");
        if (!error && Array.isArray(rows)) {
          for (const r of rows as { product_id: string; variant_id: string | null; rating_sum: number | string; review_count: number | string }[]) {
            const entry = { sum: Number(r.rating_sum), count: Number(r.review_count) };
            if (r.variant_id) data.byVariant.set(r.variant_id, entry);
            else data.legacy.set(r.product_id, entry);
          }
        }
      } catch {
        /* no ratings: cards stay blank */
      }
      cache = { at: Date.now(), data };
      return data;
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** Average rating of the given colours (one card = every colour that shares the card's Main Color), or null when nobody has rated. */
export function ratingFor(summary: RatingSummary | null, productId: string, variantIds: string[]): number | null {
  if (!summary) return null;
  let sum = 0;
  let count = 0;
  for (const id of variantIds) {
    const e = summary.byVariant.get(id);
    if (e) {
      sum += e.sum;
      count += e.count;
    }
  }
  if (!count) {
    const l = summary.legacy.get(productId);
    if (l) {
      sum = l.sum;
      count = l.count;
    }
  }
  return count ? sum / count : null;
}

export function useRatingSummary(): RatingSummary | null {
  const [summary, setSummary] = useState<RatingSummary | null>(cache && Date.now() - cache.at < TTL_MS ? cache.data : null);
  useEffect(() => {
    let cancelled = false;
    loadRatingSummary().then((d) => {
      if (!cancelled) setSummary(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return summary;
}
