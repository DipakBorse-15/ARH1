import { supabase } from "@/lib/supabase";
import type { Product, ProductVariant, ProductWithVariants } from "@/types";

const PRODUCT_SELECT = `
  *,
  category:categories(*),
  collection:collections(*),
  variants:product_variants(
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

  let query = supabase.from("products").select(PRODUCT_SELECT, { count: "exact" }).eq("active", true);

  if (categorySlug) {
    const { data: cat } = await supabase.from("categories").select("id").eq("slug", categorySlug).maybeSingle();
    if (!cat) return { products: [], total: 0 };
    query = query.eq("category_id", cat.id);
  }

  if (collectionSlug) {
    const { data: col } = await supabase.from("collections").select("id").eq("slug", collectionSlug).maybeSingle();
    if (!col) return { products: [], total: 0 };
    query = query.eq("collection_id", col.id);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%,description.ilike.%${search}%`);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error, count } = await query;
  if (error) throw error;

  let products = ((data || []) as ProductWithVariants[]).map(sortVariantImages);

  // Only keep products that still have at least one active/available variant.
  products = products.filter((p) => p.variants.some((v) => v.active));

  if (filters.color) {
    products = products.filter((p) => p.variants.some((v) => v.color === filters.color));
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

  const total = filters.color || filters.inStockOnly || filters.minPrice || filters.maxPrice ? products.length : count || products.length;

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

export async function fetchBestsellers(limit = 8): Promise<SimilarItem[]> {
  // No sales-count data yet, so "bestseller" = the biggest current discounts —
  // a reasonable stand-in that also doubles as a "deals" section.
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(60);
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
    .select(PRODUCT_SELECT)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(60);
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

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertVariant(variant: Partial<ProductVariant>) {
  const { images: _images, ...payload } = variant;
  const { data, error } = await supabase.from("product_variants").upsert(payload).select().single();
  if (error) throw error;
  return data as ProductVariant;
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

export async function uploadProductImage(file: File, variantId: string): Promise<{ path: string; url: string }> {
  const ext = file.name.split(".").pop();
  const path = `${variantId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return { path, url: data.publicUrl };
}
