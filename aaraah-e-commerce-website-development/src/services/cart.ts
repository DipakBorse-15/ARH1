import { supabase } from "@/lib/supabase";
import type { CartItem } from "@/types";

const CART_SELECT = `
  *,
  variant:product_variants(
    *,
    images:product_images(*),
    product:products(*)
  )
`;

export async function fetchCart(userId: string): Promise<CartItem[]> {
  const { data, error } = await supabase.from("cart_items").select(CART_SELECT).eq("user_id", userId).order("created_at");
  if (error) throw error;
  return (data || []) as CartItem[];
}

export async function addToCart(userId: string, variantId: string, quantity: number): Promise<void> {
  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("variant_id", variantId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("cart_items").update({ quantity: existing.quantity + quantity }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("cart_items").insert({ user_id: userId, variant_id: variantId, quantity });
    if (error) throw error;
  }
}

export async function updateCartQuantity(cartItemId: string, quantity: number): Promise<void> {
  if (quantity <= 0) {
    await removeCartItem(cartItemId);
    return;
  }
  const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", cartItemId);
  if (error) throw error;
}

export async function removeCartItem(cartItemId: string): Promise<void> {
  const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId);
  if (error) throw error;
}

export async function clearCart(userId: string): Promise<void> {
  const { error } = await supabase.from("cart_items").delete().eq("user_id", userId);
  if (error) throw error;
}
