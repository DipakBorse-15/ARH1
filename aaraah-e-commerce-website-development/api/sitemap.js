// Vercel serverless function: live sitemap built from the database, so new
// categories, collections and products are picked up without re-uploading anything.
// Served at /sitemap.xml (see vercel.json). Falls back to a small static list if the
// database cannot be reached.
import { colorSlug } from "./_lib/seoText.js";

const SITE = "https://aaraah.in";

const STATIC_PATHS = [
  "/",
  "/privacy-policy",
  "/terms-and-conditions",
  "/returns-and-refunds",
  "/shipping-policy",
  "/about",
  "/contact",
  "/faq",
];

// PostgREST returns at most 1000 rows per request, so read page by page until a short page comes back.
async function rows(base, key, table, select, extra = "") {
  const out = [];
  for (let offset = 0; offset < 50000; offset += 1000) {
    const res = await fetch(`${base}/rest/v1/${table}?select=${select}${extra}&limit=1000&offset=${offset}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`${table}: ${res.status}`);
    const page = await res.json();
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default async function handler(req, res) {
  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  const urls = STATIC_PATHS.map((p) => ({ loc: SITE + p, priority: p === "/" ? "1.0" : "0.3" }));
  try {
    if (base && key) {
      const [cats, colours, cols] = await Promise.all([
        rows(base, key, "categories", "slug", "&active=eq.true&order=slug"),
        // Every active colour of every active parent gets its own address (own canonical, title, description).
        rows(base, key, "product_variants", "color,updated_at,products!inner(slug)", "&active=eq.true&products.active=eq.true&order=id"),
        rows(base, key, "collections", "slug", "&active=eq.true&order=slug").catch(() => []),
      ]);
      for (const c of cols) urls.push({ loc: `${SITE}/collection/${c.slug}`, priority: "0.7" });
      for (const c of cats) {
        urls.push({ loc: `${SITE}/category/${c.slug}`, priority: "0.8" });
        urls.push({ loc: `${SITE}/category/${c.slug}/all`, priority: "0.7" });
      }
      for (const v of colours) {
        const slug = v.products && v.products.slug;
        if (!slug) continue;
        const q = v.color ? `?variant=${encodeURIComponent(colorSlug(v.color))}` : "";
        urls.push({ loc: `${SITE}/products/${slug}${q}`, priority: "0.6", lastmod: v.updated_at });
      }
    }
  } catch (e) {
    // keep the static list
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(String(u.lastmod).slice(0, 10))}</lastmod>` : ""}<priority>${u.priority}</priority></url>`
      )
      .join("\n") +
    `\n</urlset>\n`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(xml);
}
