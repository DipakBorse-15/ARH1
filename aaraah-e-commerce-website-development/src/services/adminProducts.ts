import { supabase } from "@/lib/supabase";
import type { DraftCheck } from "@/lib/variantEdit";

/**
 * Data for the phone "Products" screen (MRP, selling price, stock of every colour).
 *
 * Light on purpose: no photos and no descriptions, so opening the screen costs very little
 * Supabase egress. Saving is "guarded": a field is only changed if it is STILL what the
 * screen showed, so a new order that took stock a moment ago can never be overwritten.
 */

const COLUMNS =
  "id, product_id, sku, color, color_hex, price, sale_price, stock_quantity, is_available, active, product:products(name, active)";

export interface VariantRow {
  id: string;
  product_id: string;
  sku: string;
  color: string | null;
  color_hex: string | null;
  price: number;
  sale_price: number | null;
  stock_quantity: number;
  is_available: boolean;
  active: boolean;
  product: { name: string; active: boolean } | null;
}

function asRow(raw: unknown): VariantRow {
  const r = raw as VariantRow & { product: unknown };
  const p = Array.isArray(r.product) ? r.product[0] : r.product;
  return {
    ...r,
    price: Number(r.price),
    sale_price: r.sale_price == null ? null : Number(r.sale_price),
    stock_quantity: Number(r.stock_quantity),
    product: (p as VariantRow["product"]) ?? null,
  };
}

const PAGE = 1000; // Supabase never returns more than 1000 rows per request, so ask page by page.
const MAX_PAGES = 10;

/** Every colour of every design, ordered by SKU (SKU is unique, so the pages never overlap or skip). */
export async function fetchVariantsLight(): Promise<VariantRow[]> {
  const all: VariantRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE;
    const { data, error } = await supabase
      .from("product_variants")
      .select(COLUMNS)
      .order("sku", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []).map(asRow);
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

export async function fetchVariantLight(id: string): Promise<VariantRow | null> {
  const { data, error } = await supabase.from("product_variants").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? asRow(data) : null;
}

export type SaveResult = { kind: "saved"; row: VariantRow } | { kind: "conflict" };

/** Thrown with a message that can be shown to the owner as it is. */
export class VariantSaveError extends Error {}

/**
 * Saves a checked change (see checkDraft). Returns { kind: "conflict" } when the colour was changed by
 * someone/something else in the meantime (for example a new order reduced the stock): nothing is saved then.
 */
export async function saveVariantGuarded(row: VariantRow, check: Extract<DraftCheck, { ok: true }>): Promise<SaveResult> {
  let q = supabase.from("product_variants").update(check.patch).eq("id", row.id);
  if (check.priceChanged) {
    q = q.eq("price", row.price);
    q = row.sale_price === null ? q.is("sale_price", null) : q.eq("sale_price", row.sale_price);
  }
  if (check.stockChanged) q = q.eq("stock_quantity", row.stock_quantity);

  const { data, error } = await q.select(COLUMNS);
  if (error) {
    const msg = (error as { message?: string }).message ?? "";
    if (/sale_le_price|check constraint/i.test(msg)) {
      throw new VariantSaveError("Selling price MRP se zyada nahi ho sakta.");
    }
    if (/permission denied|row-level security|policy/i.test(msg)) {
      throw new VariantSaveError("Is account ko ye badlav karne ki permission nahi hai. Admin account se sign in karo.");
    }
    if (/fetch|network|failed to/i.test(msg)) {
      throw new VariantSaveError("Internet nahi chal raha. Connection check karke dobara Save karo.");
    }
    throw new VariantSaveError("Save nahi ho paya. Thodi der baad dobara try karo.");
  }
  if (!data || data.length === 0) return { kind: "conflict" };
  return { kind: "saved", row: asRow(data[0]) };
}
