import { supabase } from "@/lib/supabase";
import { resizeImage } from "@/lib/imageResize";
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

// Lighter select for storefront cards: no category/variant-collection embeds.
const CARD_SELECT = `
  *,
  collection:collections(*),
  variants:product_variants(
    *,
    images:product_images(*)
  )
`;

// Same, but only products that have at least one ACTIVE variant (inner join),
// so the database can count and page them correctly.
const CARD_SELECT_ACTIVE = `
  *,
  collection:collections(*),
  variants:product_variants!inner(
    *,
    images:product_images(*)
  )
`;

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

export interface ProductFilterResult {
  products: ProductWithVariants[];
  total: number;
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
  const { categorySlug, collectionSlug, search, page = 1, pageSize = 12 } = filters;

  // Plain browsing (category or search, newest first, no variant-level filter) is paged
  // by the database, so only one page of products is ever downloaded.
  const needsClientFilter =
    !!filters.color || !!filters.size || !!filters.inStockOnly || typeof filters.minPrice === "number" || typeof filters.maxPrice === "number" ||
    !!collectionSlug || filters.sort === "price-asc" || filters.sort === "price-desc";

  let query = needsClientFilter
    ? supabase.from("products").select(CARD_SELECT, { count: "exact" }).eq("active", true)
    : supabase.from("products").select(CARD_SELECT_ACTIVE, { count: "exact" }).eq("active", true).eq("variants.active", true);

  if (categorySlug) {
    const { data: cat } = await supabase.from("categories").select("id").eq("slug", categorySlug).maybeSingle();
    if (!cat) return { products: [], total: 0 };
    query = query.eq("category_id", cat.id);
  }

  // Collection membership can be set per-variant now, so it can't be pushed
  // down into the products-table query below — resolved and applied after
  // fetching (see the `collectionId` block further down).
  let collectionId: string | null = null;
  if (collectionSlug) {
    const { data: col } = await supabase.from("collections").select("id").eq("slug", collectionSlug).maybeSingle();
    if (!col) return { products: [], total: 0 };
    collectionId = col.id;
  }

  // Remove characters that have a special meaning inside the PostgREST filter string.
  const safeSearch = (search || "").replace(/[,()%*\\"':;]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (safeSearch) {
    query = query.or(`name.ilike.%${safeSearch}%,brand.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
  }

  query = query.order("created_at", { ascending: false });

  if (!needsClientFilter) {
    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = ((data || []) as ProductWithVariants[]).map(sortVariantImages);
    return { products: rows, total: count ?? rows.length };
  }

  const { data, error, count } = await query;
  if (error) throw error;

  let products = ((data || []) as ProductWithVariants[]).map(sortVariantImages);

  // Only keep products that still have at least one active variant.
  products = products.filter((p) => p.variants.some((v) => v.active));

  if (collectionId) {
    products = products
      .map((p) => ({
        ...p,
        variants: p.variants.filter((v) => variantCollectionId(p, v) === collectionId),
      }))
      .filter((p) => p.variants.some((v) => v.active));
  }

  if (filters.color) {
    products = products.filter((p) => p.variants.some((v) => v.color === filters.color));
  }
  if (filters.size) {
    const wanted = filters.size.toUpperCase();
    products = products.filter((p) => p.variants.some((v) => v.active && variantSizes(v).includes(wanted)));
  }
  if (filters.inStockOnly) {
    products = products.filter((p) => p.variants.some((v) => v.active && v.is_available && v.stock_quantity > 0));
  }
  if (typeof filters.minPrice === "number") {
    products = products.filter((p) => productMinPrice(p) >= (filters.minPrice as number));
  }
  if (typeof filters.maxPrice === "number") {
    products = products.filter((p) => productMinPrice(p) <= (filters.maxPrice as number));
  }

  switch (filters.sort) {
    case "price-asc":
      products = products.sort((a, b) => productMinPrice(a) - productMinPrice(b));
      break;
    case "price-desc":
      products = products.sort((a, b) => productMinPrice(b) - productMinPrice(a));
      break;
    default:
      break; // newest / relevance already ordered by created_at
  }

  const total =
    filters.color || filters.size || filters.inStockOnly || filters.minPrice || filters.maxPrice || collectionId
      ? products.length
      : count || products.length;

  const start = (page - 1) * pageSize;
  const paged = products.slice(start, start + pageSize);

  return { products: paged, total };
}

export async function fetchProductBySlug(slug: string): Promise<ProductWithVariants | null> {
  const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("slug", slug).eq("active", true).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return sortVariantImages(data as ProductWithVariants);
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

  const { data, error } = await supabase.from("products").select(CARD_SELECT).eq("active", true);
  if (error) throw error;

  const pool: SimilarItem[] = [];
  ((data || []) as ProductWithVariants[]).map(sortVariantImages).forEach((product) => {
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

export async function fetchBestsellers(limit = 8): Promise<SimilarItem[]> {
  // No sales-count data yet, so "bestseller" = the biggest current discounts —
  // a reasonable stand-in that also doubles as a "deals" section.
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;

  const products = ((data || []) as ProductWithVariants[]).map(sortVariantImages);
  const pool: SimilarItem[] = [];
  products.forEach((product) => {
    product.variants
      .filter((v) => v.active && v.sale_price != null && v.sale_price < v.price)
      .forEach((variant) => pool.push({ product, variant }));
  });

  pool.sort((a, b) => {
    const discA = a.variant.price > 0 ? (a.variant.price - (a.variant.sale_price ?? a.variant.price)) / a.variant.price : 0;
    const discB = b.variant.price > 0 ? (b.variant.price - (b.variant.sale_price ?? b.variant.price)) / b.variant.price : 0;
    return discB - discA;
  });

  return pool.slice(0, limit);
}

export async function fetchSimilarVariants(currentVariantId: string, limit = 8): Promise<SimilarItem[]> {
  // "Similar" is per-SKU, not per-product: sibling colours of the SAME design
  // count too, since each SKU is its own listing. We only ever exclude the
  // one variant the customer is currently looking at.
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) throw error;

  const products = ((data || []) as ProductWithVariants[]).map(sortVariantImages);
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
  let filePaths: string[] = [];
  try {
    const { data: vars } = await supabase.from("product_variants").select("id").eq("product_id", id);
    const ids = (vars || []).map((v: { id: string }) => v.id);
    if (ids.length) {
      const { data: imgs } = await supabase.from("product_images").select("url").in("variant_id", ids);
      filePaths = (imgs || [])
        .map((i: { url: string }) => i.url.split("/product-images/")[1])
        .filter(Boolean)
        .map((p: string) => decodeURIComponent(p.split("?")[0]));
    }
  } catch {
    /* cleanup is best-effort; never block the delete */
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

export async function addVariantImage(image: { variant_id: string; storage_path: string; url: string; alt_text?: string; sort_order?: number }) {
  const { data, error } = await supabase.from("product_images").insert(image).select().single();
  if (error) throw error;
  return data;
}

export async function deleteVariantImage(id: string) {
  const { error } = await supabase.from("product_images").delete().eq("id", id);
  if (error) throw error;
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

export async function uploadProductImage(original: File, variantId: string): Promise<{ path: string; url: string }> {
  const file = await resizeImage(original, 1600);
  const ext = file.name.split(".").pop();
  const path = `${variantId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return { path, url: data.publicUrl };
}
