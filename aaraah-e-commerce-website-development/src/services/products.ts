import { supabase } from "@/lib/supabase";
import { resizeImage } from "@/lib/imageResize";
import { THUMB_SIDE, THUMB_QUALITY } from "@/lib/thumb";
import { shortSlug } from "@/lib/slugs";
import type { Collection, Product, ProductVariant, ProductWithVariants } from "@/types";

const PRODUCT_SELECT = `
  *,
  category:categories(*),
  collection:collections(*),
  variants:product_variants(
    *,
    images:product_images(*),
    collection:collections(*)
  )
`;

// Lean select for the many small product cards (home page, "similar" strip): only what a card shows.
// No descriptions, bullet points, SEO text, or any other long text. KEEP IN SYNC with FEED_SELECT in hostinger/server.js.
const CARD_LITE_SELECT =
  "id,brand,parent_sku,name,slug,category_id,collection_id,active,created_at," +
  "collection:collections(id,name,slug)," +
  "variants:product_variants(id,product_id,sku,color,color_hex,price,sale_price,discount_percent,discount_amount,stock_quantity,is_available,active,collection_id,sort_order,created_at,attributes," +
  "images:product_images(id,variant_id,url,thumb_url,alt_text,sort_order))";

// The card list is remembered for 2 minutes inside the open page, so moving between Home, categories and
// product pages does not download it again. On Hostinger (VITE_IMG_PROXY=1) it comes from our own server,
// which asks Supabase at most once every 2 minutes for ALL visitors together; if that server answer is
// missing for any reason, the browser asks Supabase directly (exactly like before).
const FEED_TTL_MS = 2 * 60_000;
let feedCache: { at: number; data: ProductWithVariants[] } | null = null;
let feedInflight: Promise<ProductWithVariants[]> | null = null;

async function fetchFeedFromOwnServer(): Promise<ProductWithVariants[] | null> {
  if (import.meta.env.VITE_IMG_PROXY !== "1") return null;
  try {
    const res = await fetch("/data/products-feed", { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json) ? (json as ProductWithVariants[]) : null;
  } catch {
    return null;
  }
}

async function loadCardFeed(): Promise<ProductWithVariants[]> {
  if (feedCache && Date.now() - feedCache.at < FEED_TTL_MS) return feedCache.data;
  if (!feedInflight) {
    feedInflight = (async () => {
      let data = await fetchFeedFromOwnServer();
      if (!data) {
        const { data: rows, error } = await supabase.from("products").select(CARD_LITE_SELECT).eq("active", true);
        if (error) throw error;
        data = (rows || []) as unknown as ProductWithVariants[];
      }
      feedCache = { at: Date.now(), data };
      return data;
    })().finally(() => {
      feedInflight = null;
    });
  }
  return feedInflight;
}

function sortVariantImages(product: ProductWithVariants): ProductWithVariants {
  return {
    ...product,
    variants: (product.variants || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ ...v, images: (v.images || []).slice().sort((a, b) => a.sort_order - b.sort_order) })),
  };
}

export interface ProductFilters {
  categorySlug?: string;
  collectionSlug?: string;
  search?: string;
  color?: string;
  size?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sort?: "newest" | "price-asc" | "price-desc" | "relevance";
  page?: number;
  pageSize?: number;
}

/** One tile on a listing page = one colour (variant) of a design (product). */
export interface ListingCard {
  product: ProductWithVariants;
  variant: ProductVariant;
}

export interface ProductFilterResult {
  /** The cards of the asked page (one per colour). */
  cards: ListingCard[];
  /** How many colour cards match all filters (all pages). */
  total: number;
  /** Colour / size choices of the WHOLE category or collection (not narrowed by the colour/size/price/stock filters). */
  colors: string[];
  sizes: string[];
}

/** Effective (sale-aware) minimum price across a product's active variants. */
export function effectivePrice(variant: ProductVariant): number {
  return Number(variant.sale_price ?? variant.price);
}

/**
 * A variant's actual collection: its own collection_id if set, otherwise it
 * inherits the parent design's collection. Same override pattern already
 * used for per-variant description/bullet_points (see migrations 0006/0008).
 */
export function variantCollectionId(
  product: Pick<Product, "collection_id">,
  variant: Pick<ProductVariant, "collection_id">
): string | null {
  return variant.collection_id ?? product.collection_id ?? null;
}

/**
 * Sizes a variant is available in. Stored as free text in attributes.size,
 * either one size ("M") or a list ("S, M, L, XL"). Empty for products that
 * have no sizes at all (most sarees, dupattas).
 */
export function variantSizes(variant: Pick<ProductVariant, "attributes">): string[] {
  const raw = variant.attributes?.size;
  if (!raw) return [];
  return raw
    .split(/[,/|]/)
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
}

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "4XL", "5XL", "FREE SIZE", "FREE"];

/** Distinct sizes across the active variants, in S→XL order (unknown labels last, A→Z). */
export function collectSizes(products: ProductWithVariants[]): string[] {
  const set = new Set<string>();
  products.forEach((p) => p.variants.forEach((v) => v.active && variantSizes(v).forEach((x) => set.add(x))));
  const rank = (x: string) => {
    const i = SIZE_ORDER.indexOf(x);
    return i === -1 ? SIZE_ORDER.length : i;
  };
  return Array.from(set).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true }));
}

export function productMinPrice(product: ProductWithVariants): number {
  const active = product.variants.filter((v) => v.active);
  if (!active.length) return 0;
  return Math.min(...active.map(effectivePrice));
}

export function productColors(product: ProductWithVariants): { color: string; hex: string | null }[] {
  const seen = new Map<string, string | null>();
  for (const v of product.variants) {
    if (v.color && v.active) seen.set(v.color, v.color_hex);
  }
  return Array.from(seen.entries()).map(([color, hex]) => ({ color, hex }));
}

export async function fetchProducts(filters: ProductFilters = {}): Promise<ProductFilterResult> {
  const { categorySlug, collectionSlug, search, page = 1, pageSize = 24 } = filters;
  const empty: ProductFilterResult = { cards: [], total: 0, colors: [], sizes: [] };

  // Category / collection pages: ONE lean list of all cards (the same list Home uses: from our own server's
  // 2-minute cache, never a per-visitor Supabase download) and every filter / sort / page is done here, per COLOUR.
  // Search keeps asking the database (it also looks inside descriptions), with the same lean fields.
  let categoryId: string | null = null;
  if (categorySlug) {
    const { data: cat } = await supabase.from("categories").select("id").eq("slug", categorySlug).maybeSingle();
    if (!cat) return empty;
    categoryId = cat.id;
  }
  let collectionId: string | null = null;
  if (collectionSlug) {
    const { data: col } = await supabase.from("collections").select("id").eq("slug", collectionSlug).maybeSingle();
    if (!col) return empty;
    collectionId = col.id;
  }

  // Remove characters that have a special meaning inside the PostgREST filter string.
  const safeSearch = (search || "").replace(/[,()%*\\"':;]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

  let parents: ProductWithVariants[];
  if (safeSearch) {
    const { data, error } = await supabase
      .from("products")
      .select(CARD_LITE_SELECT)
      .eq("active", true)
      .or(`name.ilike.%${safeSearch}%,brand.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    parents = (data || []) as unknown as ProductWithVariants[];
  } else {
    parents = (await loadCardFeed()).slice().sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  }
  if (categoryId) parents = parents.filter((p) => p.category_id === categoryId);

  // Every active colour of every design = one card. Order: newest design first, colours in their own order.
  let cards: ListingCard[] = parents.map(sortVariantImages).flatMap((p) =>
    p.variants
      .filter((v) => v.active && (!collectionId || variantCollectionId(p, v) === collectionId))
      .map((variant) => ({ product: p, variant }))
  );

  // Choices shown in the filter panel come from the whole set, before the filters below narrow it.
  const colors = Array.from(new Set(cards.map((c) => c.variant.color).filter((x): x is string => !!x)));
  const sizes = collectSizes(cards.map((c) => ({ ...c.product, variants: [c.variant] })));

  if (filters.color) cards = cards.filter((c) => c.variant.color === filters.color);
  if (filters.size) {
    const wanted = filters.size.toUpperCase();
    cards = cards.filter((c) => variantSizes(c.variant).includes(wanted));
  }
  if (filters.inStockOnly) cards = cards.filter((c) => c.variant.is_available && c.variant.stock_quantity > 0);
  if (typeof filters.minPrice === "number") cards = cards.filter((c) => effectivePrice(c.variant) >= (filters.minPrice as number));
  if (typeof filters.maxPrice === "number") cards = cards.filter((c) => effectivePrice(c.variant) <= (filters.maxPrice as number));

  if (filters.sort === "price-asc") cards = cards.slice().sort((a, b) => effectivePrice(a.variant) - effectivePrice(b.variant));
  else if (filters.sort === "price-desc") cards = cards.slice().sort((a, b) => effectivePrice(b.variant) - effectivePrice(a.variant));
  // newest / relevance: already newest design first

  const start = (page - 1) * pageSize;
  return { cards: cards.slice(start, start + pageSize), total: cards.length, colors, sizes };
}

export async function fetchProductBySlug(slug: string): Promise<ProductWithVariants | null> {
  const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("slug", slug).eq("active", true).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return sortVariantImages(data as ProductWithVariants);
}

export interface ParentOption {
  id: string;
  name: string;
  parent_sku: string | null;
  category_id: string | null;
  collection_id: string | null;
  slug: string;
  variants: Pick<ProductVariant, "id" | "color" | "sku">[];
}

/** All parents (groups) for the "which parent?" picker in Admin -> New listing. */
export async function fetchParentOptions(): Promise<ParentOption[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,parent_sku,category_id,collection_id,slug,variants:product_variants(id,color,sku)")
    .order("name")
    .limit(2000);
  if (error) throw error;
  return (data || []) as ParentOption[];
}

/** Creates a parent (group only: no photos, no price). Short web address from name + parent SKU. */
export async function createParent(input: {
  name: string;
  parent_sku: string;
  category_id: string | null;
  collection_id: string | null;
  brand: string;
}): Promise<Product> {
  const base = shortSlug(input.name, input.parent_sku) || "product";
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`;
    const { data, error } = await supabase
      .from("products")
      .insert({ ...input, slug, bullet_points: [], active: true })
      .select()
      .single();
    if (!error) return data as Product;
    lastError = error;
    // 23505 = unique violation; only the slug is worth retrying (parent SKU clash must be reported).
    if ((error as { code?: string }).code !== "23505" || !/slug/i.test(error.message || "")) break;
  }
  throw lastError;
}

/** The newest colour of a parent, used to pre-fill "Aur ek colour jodo". */
export async function fetchLastVariantOf(productId: string): Promise<ProductVariant | null> {
  const { data, error } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ProductVariant) || null;
}

/** The current slug of a product that used to have `oldSlug` as its web address (or null). */
export async function fetchSlugForOldSlug(oldSlug: string): Promise<string | null> {
  const { data, error } = await supabase.from("products").select("slug").contains("old_slugs", [oldSlug]).eq("active", true).limit(1).maybeSingle();
  if (error) throw error;
  return data?.slug ?? null;
}

export interface SimilarItem {
  product: ProductWithVariants;
  variant: ProductVariant;
}

export interface HomeCollectionRow {
  collection: Collection;
  /** First `perCollection` colours, newest first. */
  items: SimilarItem[];
  /** Everything in the collection — drives the "More products" button. */
  total: number;
}

export interface HomeFeed {
  latest: SimilarItem[];
  collectionRows: HomeCollectionRow[];
}

/**
 * Everything the homepage product sections need, from ONE query: the newest
 * `latestCount` colours across the store, plus the newest `perCollection`
 * colours of every collection. Each colour is its own tile (same as the rest
 * of the storefront), and a colour belongs to a collection by its own
 * collection_id, falling back to its design's (see variantCollectionId).
 *
 * Fetches all active designs rather than a capped page, so a colour freshly
 * added to an old design still lands in "latest". Fine at today's catalogue
 * size; if it grows into the thousands, move this to a server-side view.
 */
export async function fetchHomeFeed(
  collections: Collection[],
  opts: { latestCount?: number; perCollection?: number; categoryId?: string } = {}
): Promise<HomeFeed> {
  const { latestCount = 12, perCollection = 8, categoryId } = opts;

  const data = await loadCardFeed();

  const pool: SimilarItem[] = [];
  data.map(sortVariantImages).forEach((product) => {
    if (categoryId && product.category_id !== categoryId) return; // category page: only this category
    product.variants.filter((v) => v.active).forEach((variant) => pool.push({ product, variant }));
  });
  pool.sort((a, b) => new Date(b.variant.created_at).getTime() - new Date(a.variant.created_at).getTime());

  const byCollection = new Map<string, SimilarItem[]>();
  pool.forEach((item) => {
    const cid = variantCollectionId(item.product, item.variant);
    if (!cid) return;
    const list = byCollection.get(cid);
    if (list) list.push(item);
    else byCollection.set(cid, [item]);
  });

  const collectionRows: HomeCollectionRow[] = [];
  collections.forEach((collection) => {
    const all = byCollection.get(collection.id) || [];
    if (all.length) collectionRows.push({ collection, items: all.slice(0, perCollection), total: all.length });
  });

  return { latest: pool.slice(0, latestCount), collectionRows };
}

export async function fetchSimilarVariants(currentVariantId: string, limit = 8): Promise<SimilarItem[]> {
  // "Similar" is per-SKU, not per-product: sibling colours of the SAME design
  // count too, since each SKU is its own listing. We only ever exclude the
  // one variant the customer is currently looking at.
  const all = await loadCardFeed();
  const products = all
    .slice()
    .sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())
    .slice(0, 24)
    .map(sortVariantImages);
  const pool: SimilarItem[] = [];
  products.forEach((product) => {
    product.variants
      .filter((v) => v.active && v.id !== currentVariantId)
      .forEach((variant) => pool.push({ product, variant }));
  });

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, limit);
}

export async function fetchVariantById(id: string): Promise<ProductVariant | null> {
  const { data, error } = await supabase
    .from("product_variants")
    .select("*, images:product_images(*), product:products(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as ProductVariant | null;
}

// ---------------------------------------------------------------------------
// Admin CRUD
// ---------------------------------------------------------------------------
export async function fetchProductByIdAdmin(id: string): Promise<ProductWithVariants | null> {
  const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return sortVariantImages(data as ProductWithVariants);
}

/** Every parent with all its colours, read in pages of 500 (the database returns at most 1000 rows per request). */
export async function fetchAllProductsPaged(): Promise<ProductWithVariants[]> {
  const out: ProductWithVariants[] = [];
  for (let from = 0; from < 20000; from += 500) {
    const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).order("created_at", { ascending: false }).order("id").range(from, from + 499);
    if (error) throw error;
    out.push(...(((data || []) as ProductWithVariants[]).map(sortVariantImages)));
    if (!data || data.length < 500) break;
  }
  return out;
}

export async function fetchAllProductsAdmin(): Promise<ProductWithVariants[]> {
  const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as ProductWithVariants[]).map(sortVariantImages);
}

export async function upsertProduct(product: Partial<Product>) {
  const { category: _category, collection: _collection, variants: _variants, ...payload } = product;
  const { data, error } = await supabase.from("products").upsert(payload).select().single();
  if (error) throw error;
  return data as Product;
}

/**
 * Partial update for an EXISTING product only (id required). Uses `.update()`
 * instead of `.upsert()` — upsert plans an INSERT-on-conflict first, which
 * fails NOT NULL checks (e.g. `slug`) when the payload only has a couple of
 * fields. Use this for quick inline edits (collection, active toggle, etc.).
 */
export async function updateProductQuick(
  id: string,
  patch: Partial<Pick<Product, "collection_id" | "category_id" | "active">>
) {
  const { data, error } = await supabase.from("products").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string) {
  // Collect this product's image files first so they don't stay in storage (and cost space) after it is gone.
  // A big photo that an old order still shows (order_items.image_url) is NOT removed, otherwise My Orders and the
  // admin order page would show a broken picture. If this cannot be checked, no big photo is removed at all.
  let filePaths: string[] = [];
  try {
    const { data: vars } = await supabase.from("product_variants").select("id").eq("product_id", id);
    const ids = (vars || []).map((v: { id: string }) => v.id);
    if (ids.length) {
      const { data: imgs, error: imgError } = await supabase.from("product_images").select("url, thumb_path").in("variant_id", ids);
      if (imgError) throw imgError;
      const { data: used, error: usedError } = await supabase.from("order_items").select("image_url").in("variant_id", ids);
      const keepUrls = new Set((used || []).map((u: { image_url: string | null }) => u.image_url).filter(Boolean));
      const canJudgeFull = !usedError;
      for (const i of (imgs || []) as { url: string; thumb_path?: string | null }[]) {
        if (i.thumb_path) filePaths.push(i.thumb_path); // thumbnails are only used by the storefront
        if (canJudgeFull && !keepUrls.has(i.url)) {
          const path = i.url.split("/product-images/")[1];
          if (path) filePaths.push(decodeURIComponent(path.split("?")[0]));
        }
      }
    }
  } catch {
    filePaths = []; /* cleanup is best-effort; never block the delete */
  }
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
  if (filePaths.length) await supabase.storage.from("product-images").remove(filePaths).catch(() => {});
}

export async function upsertVariant(variant: Partial<ProductVariant>) {
  const { images: _images, collection: _collection, ...payload } = variant;
  const { data, error } = await supabase.from("product_variants").upsert(payload).select().single();
  if (error) throw error;
  return data as ProductVariant;
}

/**
 * Partial update for an EXISTING variant only (id required) — same reasoning
 * as `updateProductQuick`. Use this for quick inline edits (price, collection).
 */
export async function updateVariantQuick(
  id: string,
  patch: Partial<Pick<ProductVariant, "price" | "sale_price" | "collection_id" | "stock_quantity">>
) {
  // Availability always follows stock — any path that changes stock_quantity
  // (quick-edit here, or the full product form) must keep is_available in
  // sync, since the storefront's "Out of stock" badge reads is_available.
  const fullPatch: Partial<ProductVariant> = { ...patch };
  if (patch.stock_quantity !== undefined) {
    fullPatch.is_available = patch.stock_quantity > 0;
  }
  const { data, error } = await supabase.from("product_variants").update(fullPatch).eq("id", id).select().single();
  if (error) throw error;
  return data as ProductVariant;
}

/** Bulk "Save All" for the admin SKU-search quick-edit table. Each row is
 * saved independently so one bad row (e.g. a duplicate SKU conflict) doesn't
 * block the rest — failures are returned, not thrown. */
export async function updateVariantsBulk(
  edits: { id: string; patch: Partial<Pick<ProductVariant, "price" | "sale_price" | "collection_id" | "stock_quantity">> }[]
): Promise<{ succeeded: string[]; failed: { id: string; error: string }[] }> {
  const results = await Promise.allSettled(edits.map((e) => updateVariantQuick(e.id, e.patch)));
  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") succeeded.push(edits[i].id);
    else failed.push({ id: edits[i].id, error: r.reason instanceof Error ? r.reason.message : String(r.reason) });
  });
  return { succeeded, failed };
}

export async function deleteVariant(id: string) {
  const { error } = await supabase.from("product_variants").delete().eq("id", id);
  if (error) throw error;
}

export async function addVariantImage(image: {
  variant_id: string;
  storage_path: string;
  url: string;
  thumb_path?: string | null;
  thumb_url?: string | null;
  alt_text?: string;
  sort_order?: number;
}) {
  const { data, error } = await supabase.from("product_images").insert(image).select().single();
  if (error) throw error;
  return data;
}

export async function deleteVariantImage(id: string) {
  // The thumbnail is used only by the storefront, so it can go with the row. The full photo is left as it was
  // (old orders may still show it).
  let thumbPath: string | null = null;
  try {
    const { data } = await supabase.from("product_images").select("thumb_path").eq("id", id).maybeSingle();
    thumbPath = (data as { thumb_path?: string | null } | null)?.thumb_path || null;
  } catch {
    /* best effort */
  }
  const { error } = await supabase.from("product_images").delete().eq("id", id);
  if (error) throw error;
  if (thumbPath) await supabase.storage.from("product-images").remove([thumbPath]).catch(() => {});
}

/** Persist a new left-to-right order for a variant's photos. The first id in
 * the array becomes sort_order 0 — that's the one the storefront (gallery
 * default, product card thumbnail) shows first. */
export async function reorderVariantImages(orderedImageIds: string[]): Promise<void> {
  const results = await Promise.allSettled(
    orderedImageIds.map((id, index) => supabase.from("product_images").update({ sort_order: index }).eq("id", id))
  );
  const failed = results.find((r) => r.status === "rejected");
  if (failed) throw new Error("Could not save the new image order");
}

export async function uploadProductImage(
  original: File,
  variantId: string
): Promise<{ path: string; url: string; thumb_path: string | null; thumb_url: string | null }> {
  const file = await resizeImage(original, 1600);
  const ext = file.name.split(".").pop();
  const path = `${variantId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false, cacheControl: "31536000" });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);

  // Small copy for cards/cart. Best effort: if it fails the full photo is simply used everywhere (nothing breaks).
  let thumb_path: string | null = null;
  let thumb_url: string | null = null;
  try {
    const small = await resizeImage(original, THUMB_SIDE, THUMB_QUALITY);
    if (small !== original && small.type === "image/webp") {
      const tPath = `${variantId}/thumb-${crypto.randomUUID()}.webp`;
      const up = await supabase.storage.from("product-images").upload(tPath, small, { upsert: false, cacheControl: "31536000" });
      if (!up.error) {
        thumb_path = tPath;
        thumb_url = supabase.storage.from("product-images").getPublicUrl(tPath).data.publicUrl;
      }
    }
  } catch {
    /* ignore */
  }
  return { path, url: data.publicUrl, thumb_path, thumb_url };
}
