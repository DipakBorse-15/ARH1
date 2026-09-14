import { supabase } from "@/lib/supabase";
import type { Collection } from "@/types";

export async function fetchCollections(): Promise<Collection[]> {
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("active", true)
    .order("name");
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
  const { data, error } = await supabase.from("collections").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Collection[];
}

export async function upsertCollection(collection: Partial<Collection>) {
  const { data, error } = await supabase.from("collections").upsert(collection).select().single();
  if (error) throw error;
  return data as Collection;
}

export async function deleteCollection(id: string) {
  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) throw error;
}
