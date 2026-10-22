import { supabase } from "@/lib/supabase";
import type { Category } from "@/types";

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data as Category[];
}

/**
 * Categories ordered by whichever had a product or colour added most recently —
 * a brand-new design and a new colour on an existing design both count, since
 * either resets that category's "last launch" to the top.
 */
export async function fetchCategoriesByRecentActivity(): Promise<Category[]> {
  const [{ data: cats, error: catErr }, { data: variants, error: varErr }] = await Promise.all([
    supabase.from("categories").select("*").eq("active", true),
    supabase
      .from("product_variants")
      .select("created_at, product:products(category_id, created_at)")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (catErr) throw catErr;
  if (varErr) throw varErr;

  type Parent = { category_id: string | null; created_at: string };
  type Row = { created_at: string; product: Parent | Parent[] | null };

  // A variant -> product link is many-to-one, so PostgREST returns `product`
  // as a single object, not an array. The old code indexed it as `[0]`, which
  // is undefined on an object — every category looked "never used" and the
  // list silently fell back to alphabetical order. Accept both shapes.
  const latestByCategory = new Map<string, number>();
  ((variants || []) as unknown as Row[]).forEach((v) => {
    const parent = Array.isArray(v.product) ? v.product[0] : v.product;
    const categoryId = parent?.category_id;
    if (!categoryId) return;
    const stamp = Math.max(new Date(v.created_at).getTime(), parent?.created_at ? new Date(parent.created_at).getTime() : 0);
    if (stamp > (latestByCategory.get(categoryId) ?? 0)) latestByCategory.set(categoryId, stamp);
  });

  const categories = (cats || []) as Category[];
  return [...categories].sort((a, b) => {
    const ta = latestByCategory.get(a.id);
    const tb = latestByCategory.get(b.id);
    if (ta && tb) return tb - ta;
    if (ta) return -1;
    if (tb) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function fetchCategoryBySlug(slug: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return data as Category | null;
}

// --- Admin ---
export async function fetchAllCategoriesAdmin(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Category[];
}

export async function upsertCategory(category: Partial<Category>) {
  const { data, error } = await supabase.from("categories").upsert(category).select().single();
  if (error) throw error;
  return data as Category;
}

/** How many products sit in this category (used to stop deleting a category that is in use). */
export async function countProductsInCategory(id: string): Promise<number> {
  const { count, error } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", id);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}
