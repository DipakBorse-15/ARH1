// Vercel serverless function: Google Merchant Center product feed (free listings), built live from the
// database. One item per active colour of every active parent. Served at /feed.xml (see vercel.json).
// Merchant Center reads this web address on a schedule; nothing has to be uploaded by hand.
import { colorSlug } from "./_lib/seoText.js";

const SITE = "https://aaraah.in";
const GOOGLE_CATEGORY = "Apparel & Accessories > Clothing > Traditional & Ceremonial Clothing > Saris & Lehengas";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
// drop control characters XML does not allow
const clean = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/\s+/g, " ").trim();
const money = (n) => `${Number(n).toFixed(2)} INR`;

async function rows(base, key, select, extra) {
  const out = [];
  for (let offset = 0; offset < 50000; offset += 1000) {
    const res = await fetch(`${base}/rest/v1/product_variants?select=${encodeURIComponent(select)}${extra}&limit=1000&offset=${offset}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`product_variants: ${res.status}`);
    const page = await res.json();
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

export default async function handler(req, res) {
  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!base || !key) {
    res.status(503).send("Feed not configured");
    return;
  }

  let variants;
  try {
    const select =
      "sku,color,price,sale_price,stock_quantity,is_available,fabric_type,description,sort_order,images:product_images(url,sort_order),products!inner(slug,name,brand,parent_sku,description,category:categories(name))";
    variants = await rows(base, key, select, "&active=eq.true&products.active=eq.true&order=id");
  } catch (e) {
    res.status(502).send("Could not read products");
    return;
  }

  const items = [];
  for (const v of variants) {
    const p = v.products;
    if (!p || !p.slug || !v.sku) continue;
    const images = (v.images || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((i) => i.url).filter(Boolean);
    if (images.length === 0) continue; // Merchant Center rejects items without a photo
    const color = clean(v.color);
    const title = clean(`${p.name}${color ? ` - ${color}` : ""}`).slice(0, 150);
    const description = clean(v.description || p.description || `${p.name}${color ? ` in ${color}` : ""} by ${p.brand || "AARAAH"}.`).slice(0, 4900);
    const link = `${SITE}/products/${encodeURIComponent(p.slug)}${color ? `?variant=${encodeURIComponent(colorSlug(color))}` : ""}`;
    const onSale = v.sale_price != null && Number(v.sale_price) > 0 && Number(v.sale_price) < Number(v.price);
    const inStock = v.is_available && v.stock_quantity > 0;
    const lines = [
      `<g:id>${esc(v.sku)}</g:id>`,
      `<g:title>${esc(title)}</g:title>`,
      `<g:description>${esc(description)}</g:description>`,
      `<g:link>${esc(link)}</g:link>`,
      `<g:image_link>${esc(images[0])}</g:image_link>`,
      ...images.slice(1, 10).map((u) => `<g:additional_image_link>${esc(u)}</g:additional_image_link>`),
      `<g:availability>${inStock ? "in_stock" : "out_of_stock"}</g:availability>`,
      `<g:price>${money(v.price)}</g:price>`,
      ...(onSale ? [`<g:sale_price>${money(v.sale_price)}</g:sale_price>`] : []),
      `<g:brand>${esc(p.brand || "AARAAH")}</g:brand>`,
      `<g:condition>new</g:condition>`,
      `<g:identifier_exists>no</g:identifier_exists>`,
      `<g:google_product_category>${esc(GOOGLE_CATEGORY)}</g:google_product_category>`,
      ...(p.category && p.category.name ? [`<g:product_type>${esc(p.category.name)}</g:product_type>`] : []),
      ...(p.parent_sku ? [`<g:item_group_id>${esc(p.parent_sku)}</g:item_group_id>`] : []),
      ...(color ? [`<g:color>${esc(color)}</g:color>`] : []),
      ...(clean(v.fabric_type) ? [`<g:material>${esc(clean(v.fabric_type).split(/[,;/]/)[0].trim())}</g:material>`] : []),
      `<g:gender>female</g:gender>`,
      `<g:age_group>adult</g:age_group>`,
    ];
    items.push(`    <item>\n      ${lines.join("\n      ")}\n    </item>`);
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n` +
    `    <title>AARAAH</title>\n    <link>${SITE}</link>\n    <description>AARAAH product feed</description>\n` +
    items.join("\n") +
    `\n  </channel>\n</rss>\n`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
  res.status(200).send(xml);
}
