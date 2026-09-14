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
