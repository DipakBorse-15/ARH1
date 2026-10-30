/**
 * Rules for the phone "Products" screen: editing one colour's MRP, selling price and stock.
 * Pure functions (no database, no React) so they are easy to test.
 *
 * Database meaning:  price = MRP,  sale_price = selling price (null = no discount).
 */

/** Stock below this number counts as "low" (same limit the phone alerts will use). */
export const LOW_STOCK_BELOW = 5;

export interface VariantEditRow {
  price: number;
  sale_price: number | null;
  stock_quantity: number;
}

/** What is typed in the three boxes (always text, exactly as typed). */
export interface VariantDraft {
  mrp: string;
  selling: string;
  stock: string;
}

export interface VariantPatch {
  price?: number;
  sale_price?: number | null;
  discount_percent?: null;
  discount_amount?: null;
  stock_quantity?: number;
  is_available?: boolean;
}

export type DraftCheck =
  | { ok: true; priceChanged: boolean; stockChanged: boolean; patch: VariantPatch }
  | { ok: false; unchanged?: boolean; message: string };

const MONEY = /^\d{1,8}(\.\d{1,2})?$/;
const WHOLE = /^\d{1,6}$/;

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** The price a customer really pays today: sale_price when it is lower than the MRP, else the MRP. */
export function effectiveSelling(row: VariantEditRow): number {
  return row.sale_price != null && row.sale_price < row.price ? row.sale_price : row.price;
}

export function draftFromRow(row: VariantEditRow): VariantDraft {
  return { mrp: fmt(row.price), selling: fmt(effectiveSelling(row)), stock: String(row.stock_quantity) };
}

/** True when something was typed that differs from what is saved. */
export function isDirty(row: VariantEditRow, draft: VariantDraft): boolean {
  const base = draftFromRow(row);
  return draft.mrp.trim() !== base.mrp || draft.selling.trim() !== base.selling || draft.stock.trim() !== base.stock;
}

/** Percent off for the little preview under the boxes (null = no discount / not a valid pair). */
export function previewPercentOff(draft: VariantDraft): number | null {
  const mrp = draft.mrp.trim();
  const selling = draft.selling.trim() === "" ? mrp : draft.selling.trim();
  if (!MONEY.test(mrp) || !MONEY.test(selling)) return null;
  const m = Number(mrp);
  const s = Number(selling);
  if (!(m > 0) || !(s > 0) || s >= m) return null;
  return Math.round(((m - s) / m) * 100);
}

/**
 * Checks what was typed and, if it is fine, builds the exact change to save.
 *  - MRP and selling price must be more than 0 (up to 2 decimals); selling price can never be above the MRP.
 *  - An empty or equal selling price means "no discount" (sale_price is cleared).
 *  - Whenever a price changes, the old stored discount % / amount are cleared so the website works out
 *    "% off" from the new prices (otherwise it would keep showing the old number).
 *  - Stock must be a whole number, 0 or more. Availability follows stock.
 */
export function checkDraft(row: VariantEditRow, draft: VariantDraft): DraftCheck {
  const mrpText = draft.mrp.trim();
  const sellingText = draft.selling.trim() === "" ? mrpText : draft.selling.trim();
  const stockText = draft.stock.trim();

  if (!MONEY.test(mrpText) || !(Number(mrpText) > 0)) {
    return { ok: false, message: "MRP sahi likho: 0 se zyada, jaise 1499 (sirf number)." };
  }
  if (!MONEY.test(sellingText) || !(Number(sellingText) > 0)) {
    return { ok: false, message: "Selling price sahi likho: 0 se zyada, jaise 999 (sirf number)." };
  }
  if (!WHOLE.test(stockText)) {
    return { ok: false, message: "Stock poora number likho: 0 ya usse zyada (decimal ya minus nahi)." };
  }

  const mrp = Math.round(Number(mrpText) * 100) / 100;
  const selling = Math.round(Number(sellingText) * 100) / 100;
  const stock = Number(stockText);

  if (selling > mrp) {
    return { ok: false, message: "Selling price MRP se zyada nahi ho sakta." };
  }

  const newSale: number | null = selling < mrp ? selling : null;
  const currentSale: number | null = row.sale_price != null && row.sale_price < row.price ? row.sale_price : null;

  const priceChanged = mrp !== row.price || newSale !== currentSale;
  const stockChanged = stock !== row.stock_quantity;
  if (!priceChanged && !stockChanged) return { ok: false, unchanged: true, message: "Kuch badla nahi." };

  const patch: VariantPatch = {};
  if (priceChanged) {
    patch.price = mrp;
    patch.sale_price = newSale;
    patch.discount_percent = null;
    patch.discount_amount = null;
  }
  if (stockChanged) {
    patch.stock_quantity = stock;
    patch.is_available = stock > 0;
  }
  return { ok: true, priceChanged, stockChanged, patch };
}
