import { supabase } from "@/lib/supabase";
import type { Order, OrderStatus, PaymentStatus } from "@/types";
import type { ShippingInput } from "@/services/orders";

/**
 * Order helpers for the phone admin screens.
 *
 * Every change here is "guarded": it only happens if the order is STILL in the status the
 * screen was showing. So a double-tap, or a second device that changed the order a moment
 * ago, can never apply the same step twice. They return false when the order had moved on.
 */

// Only what the list needs (no photos, no addresses) so a page of orders stays small.
const LIST_COLUMNS =
  "id, order_number, created_at, full_name, mobile, total, status, payment_status, payment_method, payment_reference, items:order_items(quantity)";

export const ORDERS_PAGE_SIZE = 20;

export type OrderListRow = Pick<
  Order,
  "id" | "order_number" | "created_at" | "full_name" | "mobile" | "total" | "status" | "payment_status" | "payment_method" | "payment_reference"
> & { items: { quantity: number }[] };

export interface OrdersPage {
  rows: OrderListRow[];
  hasMore: boolean;
}

/** Newest first. `before` = created_at of the last row already shown (loads the next page). */
export async function fetchOrdersPageAdmin(opts: {
  status: OrderStatus | "all";
  search: string;
  before?: string | null;
}): Promise<OrdersPage> {
  let q = supabase
    .from("orders")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(ORDERS_PAGE_SIZE + 1);

  if (opts.status !== "all") q = q.eq("status", opts.status);
  if (opts.before) q = q.lt("created_at", opts.before);

  // Letters, digits and spaces only, so nothing typed can break the filter.
  const term = opts.search.replace(/[^A-Za-z0-9 ]/g, "").trim();
  if (term) q = q.or(`order_number.ilike.%${term}%,full_name.ilike.%${term}%,mobile.ilike.%${term}%`);

  const { data, error } = await q;
  if (error) throw error;
  const all = (data || []) as unknown as OrderListRow[];
  return { rows: all.slice(0, ORDERS_PAGE_SIZE), hasMore: all.length > ORDERS_PAGE_SIZE };
}

async function guardedUpdate(
  orderId: string,
  fromStatuses: OrderStatus[],
  patch: Record<string, unknown>
): Promise<boolean> {
  const { data, error } = await supabase.from("orders").update(patch).eq("id", orderId).in("status", fromStatuses).select("id");
  if (error) throw error;
  return !!data && data.length > 0;
}

/** pending -> confirmed. For an unpaid UPI order the payment is marked received at the same time. */
export function confirmOrderGuarded(orderId: string, alsoMarkPaid: boolean): Promise<boolean> {
  const patch: { status: OrderStatus; payment_status?: PaymentStatus } = { status: "confirmed" };
  if (alsoMarkPaid) patch.payment_status = "paid";
  return guardedUpdate(orderId, ["pending"], patch);
}

/** confirmed -> processing */
export function startProcessingGuarded(orderId: string): Promise<boolean> {
  return guardedUpdate(orderId, ["confirmed"], { status: "processing" });
}

/** confirmed / processing -> shipped, saving the courier details in the same step. */
export function markShippedGuarded(orderId: string, input: ShippingInput): Promise<boolean> {
  return guardedUpdate(orderId, ["confirmed", "processing"], {
    status: "shipped",
    shipped_at: new Date().toISOString(),
    courier_name: input.courier_name.trim() || null,
    tracking_number: input.tracking_number.trim() || null,
    tracking_url: input.tracking_url.trim() || null,
  });
}

/** shipped -> delivered */
export function markDeliveredGuarded(orderId: string): Promise<boolean> {
  return guardedUpdate(orderId, ["shipped"], { status: "delivered" });
}

/** Return / cancelled-after-payment: the money was given back to the customer. Only a "paid" order can be refunded. */
export async function markRefundedGuarded(orderId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("orders")
    .update({ payment_status: "refunded" })
    .eq("id", orderId)
    .eq("payment_status", "paid")
    .select("id");
  if (error) throw error;
  return !!data && data.length > 0;
}

/** Edit the courier details of an order that is already shipped / delivered. */
export async function saveCourierDetails(orderId: string, input: ShippingInput): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({
      courier_name: input.courier_name.trim() || null,
      tracking_number: input.tracking_number.trim() || null,
      tracking_url: input.tracking_url.trim() || null,
    })
    .eq("id", orderId);
  if (error) throw error;
}

/** "Payment received" / "Order confirmed" email. Returns false if it could not be sent (the order itself is already saved). */
export async function sendPaymentConfirmedEmail(orderId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("send-payment-confirmed-email", { body: { order_id: orderId } });
    return !error && !data?.error;
  } catch {
    return false;
  }
}
