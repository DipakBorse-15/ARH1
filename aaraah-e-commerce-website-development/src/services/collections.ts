import { supabase } from "@/lib/supabase";
import type { Collection } from "@/types";

export async function fetchCollections(): Promise<Collection[]> {
  // Ordered by the position set in Admin → Collections. If the 0023 SQL has not been run yet
  // (no sort_order column) fall back to A–Z so the storefront never breaks.
  const ordered = await supabase.from("collections").select("*").eq("active", true).order("sort_order").order("name");
  if (!ordered.error) return ordered.data as Collection[];
  const { data, error } = await supabase.from("collections").select("*").eq("active", true).order("name");
  if (error) throw error;
  return data as Collection[];
}

export async function fetchCollectionBySlug(slug: string): Promise<Collection | null> {
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return data as Collection | null;
}

// --- Admin ---
export async function fetchAllCollectionsAdmin(): Promise<Collection[]> {
  const ordered = await supabase.from("collections").select("*").order("sort_order").order("name");
  if (!ordered.error) return ordered.data as Collection[];
  const { data, error } = await supabase.from("collections").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Collection[];
}

export async function upsertCollection(collection: Partial<Collection>) {
  const { data, error } = await supabase.from("collections").upsert(collection).select().single();
  if (error) throw error;
  return data as Collection;
}

/** Change only the position of a collection (a plain UPDATE, so no other column is touched). */
export async function setCollectionPosition(id: string, position: number) {
  const { error } = await supabase.from("collections").update({ sort_order: position }).eq("id", id);
  if (error) throw error;
}

export async function deleteCollection(id: string) {
  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) throw error;
}
