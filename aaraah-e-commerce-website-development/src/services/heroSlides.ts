import { supabase } from "@/lib/supabase";
import type { HeroSlide } from "@/types";

export async function fetchActiveHeroSlides(): Promise<HeroSlide[]> {
  const { data, error } = await supabase
    .from("hero_slides")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as HeroSlide[];
}

export async function fetchAllHeroSlidesAdmin(): Promise<HeroSlide[]> {
  const { data, error } = await supabase.from("hero_slides").select("*").order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as HeroSlide[];
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
