import { supabase } from "@/lib/supabase";
import type { CategoryCollection } from "@/types";

const SELECT = "*, collection:collections(*)";

/** Storefront: the collections an admin set up for one category, in position order.
 *  Returns [] when nothing is set up (or the 0024 SQL has not been run yet), so the
 *  category page simply falls back to showing collections that have products. */
export async function fetchCategoryCollections(categoryId: string): Promise<CategoryCollection[]> {
  const { data, error } = await supabase
    .from("category_collections")
    .select(SELECT)
    .eq("category_id", categoryId)
    .order("sort_order");
  if (error || !data) return [];
  return (data as unknown as CategoryCollection[]).filter((r) => r.collection && r.collection.active);
}

// --- Admin ---
export async function fetchCategoryCollectionsAdmin(categoryId: string): Promise<CategoryCollection[]> {
  const { data, error } = await supabase
    .from("category_collections")
    .select(SELECT)
    .eq("category_id", categoryId)
    .order("sort_order");
  if (error) throw error;
  return (data || []) as unknown as CategoryCollection[];
}

export async function addCategoryCollection(categoryId: string, collectionId: string, position: number) {
  const { error } = await supabase
    .from("category_collections")
    .insert({ category_id: categoryId, collection_id: collectionId, sort_order: position });
  if (error) throw error;
}

export async function updateCategoryCollectionImages(id: string, patch: { image?: string | null; mobile_image?: string | null }) {
  const { error } = await supabase.from("category_collections").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setCategoryCollectionPosition(id: string, position: number) {
  const { error } = await supabase.from("category_collections").update({ sort_order: position }).eq("id", id);
  if (error) throw error;
}

export async function removeCategoryCollection(id: string) {
  const { error } = await supabase.from("category_collections").delete().eq("id", id);
  if (error) throw error;
}
