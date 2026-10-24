// ONE shared place for: Google title / description of a product colour, and the short web address (slug)
// of a parent product. Used by the website (src/lib/seoText.ts, src/lib/slugs.ts) AND by the Vercel
// functions (api/sitemap.js, api/product.js), so everyone produces exactly the same text.
// The file name starts with "_" so Vercel does not treat it as a web address of its own.
//
// Text is built ONLY from fields already filled in the admin: product name, colour, fabric type,
// work type, work pattern, best for (= occasion), included components. Empty fields are left out.

const BRAND = "AARAAH";
const BRAND_SUFFIX = ` | ${BRAND}`; // the website adds this to every title by itself
export const TITLE_CORE_MAX = 60 - BRAND_SUFFIX.length; // 51
export const DESC_MAX = 160;

const TYPE_WORDS = [
  [/lehenga/i, "Lehenga"],
  [/saree|sari\b/i, "Saree"],
  [/kurta\s*set|kurti\s*set|kurtie?s?\s*set/i, "Kurta Set"],
  [/kurti|kurtie/i, "Kurti"],
  [/kurta/i, "Kurta"],
  [/dress\s*material/i, "Dress Material"],
  [/dupatta/i, "Dupatta"],
  [/stole/i, "Stole"],
  [/blouse/i, "Blouse"],
  [/palazzo/i, "Palazzo"],
  [/legging/i, "Leggings"],
  [/salwar/i, "Salwar"],
  [/churidar/i, "Churidar"],
];

const titleCase = (s) => String(s || "").toLowerCase().replace(/(^|[\s\-/(])([a-z])/g, (_m, a, b) => a + b.toUpperCase());

/** First value of a "a, b / c" style field. */
function firstOf(v) {
  return String(v || "").split(/[,;/|]+/).map((x) => x.trim()).find(Boolean) || "";
}

/** Joins words, dropping a word that already appeared (e.g. colour "Teal Georgette" + fabric "Georgette"). */
function joinUnique(parts) {
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    for (const w of String(p || "").split(/\s+/).filter(Boolean)) {
      const k = w.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(w);
      }
    }
  }
  return out.join(" ");
}

/** Colour as used in product web addresses: ?variant=royal-blue */
export function colorSlug(color) {
  return String(color || "").toLowerCase().trim().replace(/\s+/g, "-");
}

/**
 * Short, readable web address for a parent product.
 *   "AARAAH Women's Georgette Solid Embellished Temple Border Saree with Unstitched Blouse Piece" + "111S101-P"
 *   -> "georgette-solid-embellished-temple-border-saree-111s101"
 * Takes out the brand, "Women's" and the "with unstitched blouse piece" tail (also when the name was cut
 * short, e.g. "...Blouse Piec"), keeps the keywords, and ends with the parent SKU so it stays unique.
 * The database function short_product_slug() (migration 0028) does exactly the same.
 */
export function shortSlug(name, parentSku) {
  let s = String(name || "").toLowerCase().replace(/[’`]/g, "'");
  s = s
    .replace(/\baaraah\b/g, " ")
    .replace(/\bwomen'?s\b/g, " ")
    .replace(/\bwith\s+(an\s+)?(unstitched\s+)?blouse(\s+piec\w*)?/g, " ")
    .replace(/\bunstitched\s+blouse(\s+piec\w*)?/g, " ");
  let base = s.replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).join("-");
  if (base.length > 70) base = base.slice(0, 70).replace(/-[^-]*$/, "");
  const sku = String(parentSku || "")
    .toLowerCase()
    .replace(/-p$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return [base, sku].filter(Boolean).join("-");
}

/** "Saree", "Kurti", "Lehenga"... found in the parent's name (or, failing that, its category). */
export function productTypeWord(productName, categoryName) {
  for (const [re, word] of TYPE_WORDS) if (re.test(productName || "")) return word;
  if (categoryName) for (const [re, word] of TYPE_WORDS) if (re.test(categoryName)) return word;
  return categoryName ? firstOf(String(categoryName).replace(/&/g, ",")) : "";
}

function pieces(product, variant) {
  return {
    type: productTypeWord(product.name, product.category && product.category.name),
    color: titleCase(variant.color || ""),
    fabric: titleCase(firstOf(variant.fabric_type)),
    work: titleCase(firstOf(variant.work_type)),
    pattern: firstOf(variant.work_pattern).toLowerCase(),
    occasion: firstOf(variant.best_for).toLowerCase(),
    included: String(variant.included_components || "").replace(/\s+/g, " ").trim().toLowerCase(),
  };
}

/** e.g. "Teal Georgette Embroidery Saree for Wedding" (the website adds " | AARAAH"). At most 51 characters. */
export function variantSeoTitle(product, variant) {
  const p = pieces(product, variant);
  const candidates = [
    p.occasion ? `${joinUnique([p.color, p.fabric, p.work, p.type])} for ${titleCase(p.occasion)}` : "",
    joinUnique([p.color, p.fabric, p.work, p.type]),
    joinUnique([p.color, p.fabric, p.type]),
    joinUnique([p.color, p.type]),
    product.name,
  ].filter(Boolean);
  const fit = candidates.find((c) => c.length <= TITLE_CORE_MAX);
  if (fit) return fit;
  const last = candidates[candidates.length - 1] || String(product.name || "");
  return last.slice(0, TITLE_CORE_MAX).replace(/\s+\S*$/, "") || last.slice(0, TITLE_CORE_MAX);
}

/** e.g. "Buy AARAAH Teal Georgette Embroidery Saree with floral pattern online. Includes saree, blouse piece. Best for wedding. Free shipping across India." (max 160) */
export function variantSeoDescription(product, variant) {
  const p = pieces(product, variant);
  const item = joinUnique([p.color, p.fabric, p.work, p.type]) || String(product.name || "");
  const lead = `Buy ${BRAND} ${item}${p.pattern ? ` with ${p.pattern} pattern` : ""}`;
  const includes = p.included ? `Includes ${p.included}.` : "";
  const best = p.occasion ? `Best for ${p.occasion}.` : "";
  const ship = "Free shipping across India.";
  const combos = [
    [`${lead} online.`, includes, best, ship],
    [`${lead} online.`, best, ship],
    [`${lead} online.`, includes, best],
    [`${lead}.`, best, ship],
    [`${lead}.`, ship],
    [`${lead}.`],
  ];
  for (const c of combos) {
    const text = c.filter(Boolean).join(" ");
    if (text.length <= DESC_MAX) return text;
  }
  return `${`${lead}.`.slice(0, DESC_MAX - 1).replace(/\s+\S*$/, "")}…`;
}

/** Which of the fields that feed the Google text are still empty (for the admin "SEO Check" page). */
export function missingSeoFields(variant) {
  const missing = [];
  if (!String(variant.color || "").trim()) missing.push("Colour");
  if (!String(variant.fabric_type || "").trim()) missing.push("Fabric");
  if (!String(variant.work_type || "").trim()) missing.push("Work Type");
  if (!String(variant.work_pattern || "").trim()) missing.push("Work Pattern");
  if (!String(variant.best_for || "").trim()) missing.push("Best For (occasion)");
  if (!String(variant.included_components || "").trim()) missing.push("Included Components");
  return missing;
}

export const categorySeoTitle = (name) => `Buy ${name} Online`;
export const collectionSeoTitle = (name) => `${name} Collection`;
export const listingSeoDescription = (name, description) =>
  String(description || "").trim() || `Shop ${name} online at ${BRAND}. Free shipping across India.`;
