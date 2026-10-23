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
  coupon_code?: string;
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
  if (error) {
    // The function replies with a readable reason (e.g. "items just sold out") — show that, not "non-2xx".
    let message = "";
    try {
      const res = (error as { context?: Response }).context;
      if (res) message = (await res.json())?.error ?? "";
    } catch {
      /* fall through to the generic error */
    }
    if (message) throw new Error(message);
    throw error;
  }
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

/** Thrown when the cancel-order function refused with a message meant for the user. */
export class CancelOrderError extends Error {}

export interface CancelOrderResult {
  cancelled: boolean;
  /** false if the customer email could not be sent (the order is still cancelled). */
  emailed: boolean;
  already?: boolean;
}

/**
 * Cancels an order through the `cancel-order` Edge Function: sets it to
 * "cancelled" (a DB trigger restores the stock) and emails the customer.
 * Customers can only cancel their own order before it ships; admins any time.
 */
export async function cancelOrder(orderId: string): Promise<CancelOrderResult> {
  const { data, error } = await supabase.functions.invoke("cancel-order", { body: { order_id: orderId } });
  if (error) {
    // For non-2xx replies the real message is in the response body.
    let message = "";
    try {
      const res = (error as { context?: Response }).context;
      if (res) message = (await res.json())?.error ?? "";
    } catch {
      /* ignore */
    }
    if (message) throw new CancelOrderError(message);
    throw error;
  }
  if (data?.error) throw new CancelOrderError(data.error);
  return data as CancelOrderResult;
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

/** Reads the real message of a failed database function call (e.g. "Wrong code"). */
function rpcMessage(error: unknown): string {
  return (error as { message?: string })?.message || "Something went wrong. Please try again.";
}

/** Customer: send the UTR / transaction number of their UPI payment. */
export async function submitPaymentReference(orderId: string, reference: string): Promise<void> {
  const { error } = await supabase.rpc("submit_payment_reference", { p_order_id: orderId, p_reference: reference });
  if (error) throw new Error(rpcMessage(error));
}

/** Admin: cancel unpaid UPI orders older than 3 hours (stock goes back). Returns how many were cancelled. */
export async function expireUnpaidOrdersAdmin(): Promise<number> {
  const { data, error } = await supabase.rpc("admin_expire_unpaid_orders");
  if (error) throw new Error(rpcMessage(error));
  return Number(data) || 0;
}

/** Unpaid UPI order older than 3 hours with no UTR sent — will be (or can be) cancelled. */
export const UNPAID_HOURS = 3;
export function isExpiredUnpaid(o: { payment_method: string; payment_status: string; status: string; payment_reference?: string | null; created_at: string }): boolean {
  return (
    o.payment_method === "upi" &&
    o.payment_status === "pending" &&
    o.status === "pending" &&
    !o.payment_reference &&
    Date.now() - new Date(o.created_at).getTime() > UNPAID_HOURS * 3600 * 1000
  );
}

/** Admin: delete one order. The server checks the code = last 4 characters of the order number. */
export async function deleteOrderAdmin(orderId: string, code: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_order", { p_order_id: orderId, p_code: code.trim() });
  if (error) throw new Error(rpcMessage(error));
}

/** Admin: delete ALL orders and restart the dashboard numbers from zero. */
export async function resetOrdersAdmin(confirmText: string): Promise<void> {
  const { error } = await supabase.rpc("admin_reset_orders", { p_confirm: confirmText });
  if (error) throw new Error(rpcMessage(error));
}

export interface ShippingInput {
  courier_name: string;
  tracking_number: string;
  tracking_url: string;
}

/** Admin: save courier/tracking details; with `markShipped` the order also becomes "shipped". */
export async function saveShippingDetails(orderId: string, input: ShippingInput, markShipped: boolean): Promise<Partial<Order>> {
  const patch: Record<string, unknown> = {
    courier_name: input.courier_name.trim() || null,
    tracking_number: input.tracking_number.trim() || null,
    tracking_url: input.tracking_url.trim() || null,
  };
  if (markShipped) {
    patch.status = "shipped";
    patch.shipped_at = new Date().toISOString();
  }
  const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
  if (error) throw error;
  return patch as Partial<Order>;
}

/** Admin: email the customer their tracking details. Returns false if the email could not be sent. */
export async function sendShippedEmail(orderId: string, kind: "shipped" | "delivered" = "shipped"): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("send-shipped-email", { body: { order_id: orderId, kind } });
    return !error && !data?.error;
  } catch {
    return false;
  }
}
