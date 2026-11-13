/**
 * "Main Color" = the colour customers FILTER by and see on the product cards (Red, Blue, Green ...).
 * It is stored in product_variants.color_group. The variant's own `color` is the "Second Color" (the
 * variation, e.g. Maroon / Wine) and is shown only on the product's final page.
 *
 * A variant with no Main Color falls back to its own colour, so nothing disappears from the filters
 * while the old products are being changed one by one.
 */

/** "royal   BLUE" -> "Royal Blue"; "off-white" -> "Off-White". Same spelling for every product, so "red" and "Red" are one filter. */
export function titleCase(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s\-/])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
}

/** What gets saved in color_group. */
export function normalizeMainColor(s: string | null | undefined): string {
  return titleCase(s ?? "");
}

type ColourFields = { id?: string; color?: string | null; color_group?: string | null };

/** The Main Color shown on cards and in the filter list. */
export function mainColorLabel(v: ColourFields): string {
  return titleCase(v.color_group || "") || titleCase(v.color || "");
}

/** Variants with the same key are ONE card on listing pages. A variant with no colour at all is never merged. */
export function mainColorKey(v: ColourFields): string {
  const label = mainColorLabel(v);
  return label ? label.toLowerCase() : `__${v.id ?? ""}`;
}

/** Suggestions for the admin Main Color boxes (the admin can still type any other name). */
export const COMMON_MAIN_COLORS = [
  "Red", "Maroon", "Pink", "Magenta", "Orange", "Peach", "Yellow", "Gold", "Green", "Teal", "Turquoise",
  "Blue", "Navy Blue", "Sky Blue", "Purple", "Brown", "Beige", "Cream", "White", "Grey", "Silver", "Black", "Multicolor",
];
