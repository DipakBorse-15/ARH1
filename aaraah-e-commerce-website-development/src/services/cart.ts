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

/** Most pieces of one item a customer can order at once (the order function enforces the same). */
export const MAX_PER_ITEM = 20;

/** A readable "can't add that many" reason (shown to the customer as it is). */
export class CartLimitError extends Error {}

/** Throws a readable CartLimitError when `inCart + quantity` is more than the stock / per-item cap allows. */
export function assertCartLimit(inCart: number, quantity: number, stock: number | null | undefined): void {
  const limit = Math.min(MAX_PER_ITEM, Number(stock ?? MAX_PER_ITEM));
  if (inCart + quantity > limit) {
    throw new CartLimitError(
      limit <= 0
        ? "Sorry, this item is out of stock."
        : inCart >= limit
          ? `You already have the maximum (${limit}) of this item in your cart.`
          : `Only ${limit} available — you already have ${inCart} in your cart.`
    );
  }
}

export async function fetchVariantStock(variantId: string): Promise<number | null> {
  const { data } = await supabase.from("product_variants").select("stock_quantity").eq("id", variantId).maybeSingle();
  return data ? Number(data.stock_quantity) : null;
}

/** Variants (with images + product) for the guest cart, by id. Missing ones are simply not returned. */
export async function fetchVariantsForCart(ids: string[]): Promise<NonNullable<CartItem["variant"]>[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("product_variants")
    .select("*, images:product_images(*), product:products(*)")
    .in("id", ids)
    .eq("active", true);
  if (error) throw error;
  return ((data || []) as NonNullable<CartItem["variant"]>[]).map((v) => ({
    ...v,
    images: (v.images || []).slice().sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function addToCart(userId: string, variantId: string, quantity: number): Promise<void> {
  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("variant_id", variantId)
    .maybeSingle();

  assertCartLimit(existing?.quantity ?? 0, quantity, await fetchVariantStock(variantId));

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
