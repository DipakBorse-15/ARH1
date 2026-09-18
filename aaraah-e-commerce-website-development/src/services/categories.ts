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
      .select("created_at, product:products(category_id)")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (catErr) throw catErr;
  if (varErr) throw varErr;

  const latestByCategory = new Map<string, string>();
  (variants || []).forEach((v: { created_at: string; product: { category_id: string | null }[] | null }) => {
    const categoryId = v.product?.[0]?.category_id;
    if (categoryId && !latestByCategory.has(categoryId)) {
      latestByCategory.set(categoryId, v.created_at);
    }
  });

  const categories = (cats || []) as Category[];
  return [...categories].sort((a, b) => {
    const ta = latestByCategory.get(a.id);
    const tb = latestByCategory.get(b.id);
    if (ta && tb) return new Date(tb).getTime() - new Date(ta).getTime();
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

export async function deleteCategory(id: string) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}
