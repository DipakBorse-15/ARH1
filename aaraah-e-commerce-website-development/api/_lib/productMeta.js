// Product facts for the page <head> (title, description, photo, price, structured data), read once per product.
// Used by hostinger/server.js to put them into the HTML that EVERY visitor (and Google) first downloads.
// Same text rules as api/product.js (link previews) and src/pages/ProductPage.tsx (kept in api/_lib/seoText.js).
import { colorSlug, variantSeoDescription, variantSeoTitle } from "./seoText.js";
import { sbHeaders } from "./sbHeaders.js";

const SITE = "https://aaraah.in";
const SELECT =
  "name,slug,brand,description,category:categories(name),variants:product_variants(color,fabric_type,work_type,work_pattern,best_for,included_components,price,sale_price,stock_quantity,is_available,active,sort_order,images:product_images(url,sort_order))";

/** At most ~160 characters, cut at a word end (same as tidyDescription in src/components/ui/SEO.tsx). */
function tidyDescription(text) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  if (flat.length <= 160) return flat;
  const cut = flat.slice(0, 157);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 100 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:-]+$/, "")}…`;
}

/**
 * Returns { type: "ok", ... } | { type: "redirect", slug } (an old address) | { type: "none" }.
 * Throws when Supabase cannot be reached (the caller then simply serves the normal page).
 */
export async function fetchProductMeta(base, key, slug) {
  const headers = sbHeaders(key);
  const r = await fetch(
    `${base}/rest/v1/products?select=${encodeURIComponent(SELECT)}&slug=eq.${encodeURIComponent(slug)}&active=eq.true&limit=1`,
    { headers, signal: AbortSignal.timeout(5000) }
  );
  if (!r.ok) throw new Error(`products ${r.status}`);
  const product = (await r.json())[0];
  if (!product) {
    const o = await fetch(
      `${base}/rest/v1/products?select=slug&old_slugs=cs.${encodeURIComponent(`{${slug}}`)}&active=eq.true&limit=1`,
      { headers, signal: AbortSignal.timeout(5000) }
    );
    if (!o.ok) throw new Error(`old slug ${o.status}`);
    const found = (await o.json())[0];
    return found && found.slug ? { type: "redirect", slug: found.slug } : { type: "none" };
  }

  const variants = (product.variants || [])
    .filter((v) => v.active)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const v = variants[0];
  const images = ((v && v.images) || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const image = (images[0] && images[0].url) || "";
  const price = v ? (v.sale_price != null && v.sale_price < v.price ? v.sale_price : v.price) : null;
  const inStock = !!v && v.is_available && v.stock_quantity > 0;

  const core = variantSeoTitle(product, v || {});
  const title = /aaraah/i.test(core) ? core : `${core} | AARAAH`;
  const description = tidyDescription(variantSeoDescription(product, v || {}));
  const canonical = `${SITE}/products/${encodeURIComponent(product.slug)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description,
    brand: { "@type": "Brand", name: product.brand || "AARAAH" },
    ...(image ? { image } : {}),
    url: canonical,
    ...(price != null
      ? {
          offers: {
            "@type": "Offer",
            url: canonical,
            priceCurrency: "INR",
            price: String(price),
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        }
      : {}),
  };

  return { type: "ok", slug: product.slug, name: product.name, title, description, image, price, canonical, jsonLd };
}

export { colorSlug };
