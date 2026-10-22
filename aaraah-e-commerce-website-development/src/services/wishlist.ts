import { supabase } from "@/lib/supabase";
import type { ProductVariant, ProductWithVariants } from "@/types";

export async function fetchWishlistIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("wishlist_items").select("variant_id").eq("user_id", userId);
  if (error) throw error;
  return (data || []).map((r) => r.variant_id as string);
}

export async function addWishlist(userId: string, variantId: string): Promise<void> {
  const { error } = await supabase.from("wishlist_items").upsert({ user_id: userId, variant_id: variantId }, { onConflict: "user_id,variant_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeWishlist(userId: string, variantId: string): Promise<void> {
  const { error } = await supabase.from("wishlist_items").delete().eq("user_id", userId).eq("variant_id", variantId);
  if (error) throw error;
}

export interface WishlistEntry {
  product: ProductWithVariants;
  variant: ProductVariant;
}

/** Saved colours (newest first) with everything a product card needs. Inactive/removed ones are skipped. */
export async function fetchWishlistEntries(userId: string): Promise<WishlistEntry[]> {
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("created_at, variant:product_variants(*, images:product_images(*), product:products(*, collection:collections(*)))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const out: WishlistEntry[] = [];
  for (const row of (data || []) as unknown as { variant: (ProductVariant & { product: ProductWithVariants }) | null }[]) {
    const v = row.variant;
    if (!v || !v.active || !v.product || !v.product.active) continue;
    const { product, ...variant } = v;
    const images = (variant.images || []).slice().sort((a, b) => a.sort_order - b.sort_order);
    const full = { ...variant, images } as ProductVariant;
    out.push({ product: { ...product, variants: [full] }, variant: full });
  }
  return out;
}
