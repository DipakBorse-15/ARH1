import { supabase } from "@/lib/supabase";
import type { Order, OrderStatus, PaymentStatus } from "@/types";

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
  payment_method: "cod" | "upi";
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

/**
 * Manual UPI flow: admin checks their own UPI app/bank, then marks the
 * payment here by hand. Marking a pending order "paid" also bumps its
 * status to "confirmed" so it moves forward in the fulfilment flow.
 */
export async function updateOrderPaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus,
  opts?: { alsoConfirm?: boolean }
): Promise<void> {
  const patch: { payment_status: PaymentStatus; status?: OrderStatus } = { payment_status: paymentStatus };
  if (opts?.alsoConfirm) patch.status = "confirmed";
  const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
  if (error) throw error;
}
