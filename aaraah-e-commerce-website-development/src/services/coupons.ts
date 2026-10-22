import { supabase } from "@/lib/supabase";

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "flat";
  discount_value: number;
  max_discount: number | null;
  min_order: number;
  usage_limit: number | null;
  per_user_limit: number;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export type CouponInput = Omit<Coupon, "id" | "created_at">;

/** Customer (checkout): does this code work for my cart? Throws the server's reason if not. */
export async function previewCoupon(code: string, subtotal: number): Promise<{ code: string; discount: number }> {
  const { data, error } = await supabase.rpc("preview_coupon", { p_code: code.trim(), p_subtotal: subtotal });
  if (error) throw new Error(error.message || "This coupon cannot be used.");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("This coupon cannot be used.");
  return { code: String(row.code), discount: Number(row.discount) };
}

// --- Admin ---
export async function fetchCouponsAdmin(): Promise<(Coupon & { used: number })[]> {
  const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  const { data: reds } = await supabase.from("coupon_redemptions").select("coupon_id, order:orders(status)");
  const used = new Map<string, number>();
  for (const r of (reds || []) as unknown as { coupon_id: string; order: { status: string } | { status: string }[] | null }[]) {
    const o = Array.isArray(r.order) ? r.order[0] : r.order;
    if (o && o.status !== "cancelled") used.set(r.coupon_id, (used.get(r.coupon_id) || 0) + 1);
  }
  return ((data || []) as Coupon[]).map((c) => ({ ...c, used: used.get(c.id) || 0 }));
}

export async function saveCoupon(id: string | null, input: CouponInput): Promise<void> {
  const row = { ...input, code: input.code.trim().toUpperCase() };
  const { error } = id ? await supabase.from("coupons").update(row).eq("id", id) : await supabase.from("coupons").insert(row);
  if (error) {
    if (/idx_coupons_code|duplicate/i.test(error.message)) throw new Error("A coupon with this code already exists.");
    throw error;
  }
}

export async function deleteCoupon(id: string): Promise<void> {
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) {
    // Used coupons are kept (their orders reference them) — just switch them off.
    throw new Error("Could not delete. If orders used this coupon, switch it off instead.");
  }
}
