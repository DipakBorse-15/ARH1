// Vercel serverless function: serves a tiny HTML page with the right title, image and
// price for ONE product, only to link-preview bots (WhatsApp, Facebook, Telegram...).
// vercel.json routes those bots here; normal visitors and Google get the regular site.
const SITE = "https://aaraah.in";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const colorSlug = (c) => String(c || "").toLowerCase().trim().replace(/\s+/g, "-");

function html(res, status, body, cache) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", cache);
  res.status(status).send(body);
}

export default async function handler(req, res) {
  const slug = String((req.query && req.query.slug) || "").trim();
  const variantParam = req.query && req.query.variant ? String(req.query.variant) : "";
  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  const notFound = () =>
    html(
      res,
      404,
      `<!doctype html><html><head><meta charset="utf-8"><title>AARAAH</title><meta property="og:title" content="AARAAH"><meta property="og:site_name" content="AARAAH"></head><body>Product not found</body></html>`,
      "s-maxage=60"
    );

  if (!slug || !base || !key) return notFound();

  let product;
  try {
    const select = "name,slug,brand,description,seo_title,seo_description,variants:product_variants(color,price,sale_price,stock_quantity,is_available,active,sort_order,images:product_images(url,sort_order))";
    const r = await fetch(
      `${base}/rest/v1/products?select=${encodeURIComponent(select)}&slug=eq.${encodeURIComponent(slug)}&active=eq.true&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!r.ok) return notFound();
    const rows = await r.json();
    product = rows && rows[0];
  } catch {
    return notFound();
  }
  if (!product) return notFound();

  const variants = (product.variants || [])
    .filter((v) => v.active)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const v = (variantParam && variants.find((x) => colorSlug(x.color) === colorSlug(variantParam))) || variants[0];
  const images = ((v && v.images) || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const image = images[0] && images[0].url;
  const price = v ? (v.sale_price != null && v.sale_price < v.price ? v.sale_price : v.price) : null;
  const inStock = !!v && v.is_available && v.stock_quantity > 0;

  const title = String(product.seo_title || "").trim()
    ? (/aaraah/i.test(product.seo_title) ? String(product.seo_title).trim() : `${String(product.seo_title).trim()} | AARAAH`)
    : `${product.name}${v && v.color ? ` - ${v.color}` : ""} | AARAAH`;
  const plain = String(product.seo_description || product.description || "").replace(/\s+/g, " ").trim();
  const description = (plain || `${product.name} by ${product.brand || "AARAAH"}. Free shipping across India.`).slice(0, 200);
  const url = `${SITE}/products/${encodeURIComponent(product.slug)}${variantParam ? `?variant=${encodeURIComponent(variantParam)}` : ""}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description,
    brand: { "@type": "Brand", name: product.brand || "AARAAH" },
    ...(image ? { image } : {}),
    url,
    ...(price != null
      ? {
          offers: {
            "@type": "Offer",
            url,
            priceCurrency: "INR",
            price: String(price),
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        }
      : {}),
  };

  const meta = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:site_name" content="AARAAH">`,
    `<meta property="og:type" content="product">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    image ? `<meta property="og:image" content="${esc(image)}">` : "",
    price != null ? `<meta property="product:price:amount" content="${esc(price)}">` : "",
    price != null ? `<meta property="product:price:currency" content="INR">` : "",
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    image ? `<meta name="twitter:image" content="${esc(image)}">` : "",
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`,
  ]
    .filter(Boolean)
    .join("\n");

  html(
    res,
    200,
    `<!doctype html><html lang="en"><head><meta charset="utf-8">\n${meta}\n</head><body><h1>${esc(product.name)}</h1>${price != null ? `<p>Rs. ${esc(price)}</p>` : ""}<p><a href="${esc(url)}">View on AARAAH</a></p></body></html>`,
    "s-maxage=300, stale-while-revalidate=3600"
  );
}
