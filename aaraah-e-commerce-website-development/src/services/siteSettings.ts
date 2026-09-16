import { supabase } from "@/lib/supabase";
import type { SiteSettings } from "@/types";

export async function fetchSiteSettings(): Promise<SiteSettings | null> {
  const { data, error } = await supabase.from("site_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw error;
  return data as SiteSettings | null;
}

export async function updateSiteSettings(patch: Partial<SiteSettings>) {
  const { data, error } = await supabase
    .from("site_settings")
    .update(patch)
    .eq("id", true)
    .select()
    .single();
  if (error) throw error;
  return data as SiteSettings;
}
