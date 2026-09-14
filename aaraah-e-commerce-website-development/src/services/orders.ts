import { supabase } from "@/lib/supabase";
import type { Order, OrderStatus } from "@/types";

export interface CheckoutPayload {
  items: { variant_id: string; quantity: number }[];
  full_name: string;
  mobile: string;
  email: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  payment_method: "cod" | "razorpay" | "cashfree" | "phonepe";
}

export interface CreateOrderResponse {
  order_id: string;
  order_number: string;
  total: number;
}

/**
 * Places an order via the `create-order` Edge Function so price, stock and
 * totals are always re-validated server-side (never trusted from the browser).
 */
export async function placeOrder(payload: CheckoutPayload): Promise<CreateOrderResponse> {
  const { data, error } = await supabase.functions.invoke("create-order", { body: payload });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as CreateOrderResponse;
}

export async function fetchMyOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Order[];
}

export async function fetchOrderById(orderId: string): Promise<Order | null> {
  const { data, error } = await supabase.from("orders").select("*, items:order_items(*)").eq("id", orderId).maybeSingle();
  if (error) throw error;
  return data as Order | null;
}

// --- Admin ---
export async function fetchAllOrdersAdmin(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, items:order_items(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Order[];
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw error;
}
