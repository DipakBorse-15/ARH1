import { supabase } from "@/lib/supabase";
import type { HeroSlide } from "@/types";

/**
 * Active banners for one page. No categoryId = the Home page (slides that
 * belong to no category). With a categoryId = that category's own banners,
 * falling back to the Home banners when the category has none yet.
 * (Filtered here rather than in the query, so it also works before the
 * category_id column exists.)
 */
export async function fetchActiveHeroSlides(categoryId?: string): Promise<HeroSlide[]> {
  const { data, error } = await supabase
    .from("hero_slides")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  const all = (data || []) as HeroSlide[];
  const home = all.filter((s) => !s.category_id);
  if (!categoryId) return home;
  const own = all.filter((s) => s.category_id === categoryId);
  return own.length ? own : home;
}

export async function fetchAllHeroSlidesAdmin(): Promise<HeroSlide[]> {
  const { data, error } = await supabase.from("hero_slides").select("*").order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as HeroSlide[];
}

export async function setHeroSlideOrder(id: string, sort_order: number) {
  const { error } = await supabase.from("hero_slides").update({ sort_order }).eq("id", id);
  if (error) throw error;
}

export async function upsertHeroSlide(slide: Partial<HeroSlide>) {
  const { data, error } = await supabase.from("hero_slides").upsert(slide).select().single();
  if (error) throw error;
  return data as HeroSlide;
}

export async function deleteHeroSlide(id: string) {
  const { error } = await supabase.from("hero_slides").delete().eq("id", id);
  if (error) throw error;
}
