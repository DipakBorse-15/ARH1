import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { formatINR } from "@/components/product/PriceDisplay";
import { useToast } from "@/contexts/ToastContext";
import { CancelOrderError, cancelOrder, fetchOrderById, saveShippingDetails, sendShippedEmail, updateOrderPaymentStatus, updateOrderStatus } from "@/services/orders";
import { friendlyError, supabase } from "@/lib/supabase";
import type { Order, OrderStatus } from "@/types";

const STATUS_FLOW: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];

export default function AdminOrderDetailPage() {
  const { orderId } = useParams();
  const { show } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [ship, setShip] = useState({ courier_name: "", tracking_number: "", tracking_url: "" });
  const [shipBusy, setShipBusy] = useState(false);

  useEffect(() => {
    if (orderId) load(orderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function load(id: string) {
    setLoading(true);
    setError(null);
    try {
      const o = await fetchOrderById(id);
      setOrder(o);
      if (o) setShip({ courier_name: o.courier_name || "", tracking_number: o.tracking_number || "", tracking_url: o.tracking_url || "" });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  // Clicking "Confirmed" is also how a manual-UPI payment gets marked
  // received — there's no separate "Mark Payment Received" button anymore.
  // For UPI orders still awaiting payment, confirming the order and
  // confirming the payment are the same real-world action for this store,
  // so they happen together and fire the payment-confirmed email.
  async function handleStatusChange(status: OrderStatus) {
    if (!order) return;

    // Cancelling goes through the cancel-order function: it puts the stock back
    // and emails the customer.
    if (status === "cancelled") {
      if (order.status === "cancelled") return;
      if (!confirm("Cancel this order? The customer will be emailed and the stock will be added back.")) return;
      setUpdating(true);
      try {
        const res = await cancelOrder(order.id);
        setOrder({ ...order, status: "cancelled" });
        if (res.emailed) show("Order cancelled, stock restored and customer emailed", "success");
        else show("Order cancelled and stock restored, but the cancellation email couldn't be sent.", "error");
      } catch (err) {
        show(err instanceof CancelOrderError ? err.message : friendlyError(err), "error");
      } finally {
        setUpdating(false);
      }
      return;
    }

    // Moving an order backwards (or re-opening a cancelled one) is allowed but easy to do by mistake.
    const rank = (s: OrderStatus) => STATUS_FLOW.indexOf(s);
    if (order.status === "cancelled") {
      if (!confirm("This order is cancelled. Re-open it? The stock will be taken again (it fails if there is not enough stock).")) return;
    } else if (rank(status) !== -1 && rank(order.status) !== -1 && rank(status) < rank(order.status)) {
      if (!confirm(`Move this order BACK from "${order.status}" to "${status}"?`)) return;
    }

    const alsoMarkPaid = status === "confirmed" && order.payment_method === "upi" && order.payment_status !== "paid";
    if (alsoMarkPaid && !confirm(`Confirm you've received ₹${order.total} via UPI for this order?`)) return;

    setUpdating(true);
    try {
      if (alsoMarkPaid) {
        await updateOrderPaymentStatus(order.id, "paid", { alsoConfirm: true });
        setOrder({ ...order, status: "confirmed", payment_status: "paid" });
        show("Order confirmed and payment marked received", "success");
        sendPaymentConfirmedEmail(order.id);
      } else {
        const firstConfirm = status === "confirmed" && order.status !== "confirmed";
        await updateOrderStatus(order.id, status);
        setOrder({ ...order, status });
        show("Order status updated", "success");
        // COD has no payment step, so "Confirmed" is the customer's order-confirmation mail.
        if (firstConfirm && order.payment_method === "cod") sendPaymentConfirmedEmail(order.id);
      }
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? "";
      show(/not enough stock/i.test(msg) ? "Not enough stock to reopen this cancelled order." : friendlyError(err), "error");
    } finally {
      setUpdating(false);
    }
  }

  // Courier + tracking. "Ship" also moves the order to shipped and emails the customer.
  async function handleShipping(mode: "ship" | "save" | "resend") {
    if (!order) return;
    if (mode !== "resend") {
      if (mode === "ship" && !ship.courier_name.trim()) return show("Enter the courier name first (e.g. India Post, Delhivery).", "error");
      if (ship.tracking_url.trim() && !/^https?:\/\//i.test(ship.tracking_url.trim())) return show("Tracking link must start with http:// or https://", "error");
    }
    if (mode === "ship" && order.payment_status !== "paid" && !confirm("Payment is not marked received for this order. Mark it shipped anyway?")) return;
    setShipBusy(true);
    try {
      if (mode !== "resend") {
        const patch = await saveShippingDetails(order.id, ship, mode === "ship");
        setOrder({ ...order, ...patch } as Order);
      }
      if (mode === "save") {
        show("Shipping details saved", "success");
      } else {
        const ok = await sendShippedEmail(order.id);
        if (ok) show(mode === "ship" ? "Marked shipped and customer emailed" : "Tracking email sent", "success");
        else show(mode === "ship" ? "Marked shipped, but the email couldn't be sent." : "The email couldn't be sent.", "error");
      }
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setShipBusy(false);
    }
  }

  // Fire-and-forget: a failed email shouldn't undo the payment confirmation
  // that already succeeded, so this only ever shows a soft warning toast.
  async function sendPaymentConfirmedEmail(id: string) {
    try {
      const { error } = await supabase.functions.invoke("send-payment-confirmed-email", { body: { order_id: id } });
      if (error) throw error;
    } catch {
      show("Order updated, but the confirmation email couldn't be sent.", "error");
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!order) return <ErrorState message="Order not found." />;

  return (
    <div className="max-w-3xl">
      <SEO title={`Order ${order.order_number}`} canonicalPath={`/admin/orders/${order.id}`} />
      <Link to="/admin/orders" className="text-sm text-rose-900 hover:underline">
        ← Back to orders
      </Link>
      <h1 className="mt-2 mb-6 font-serif text-2xl font-semibold text-stone-900">Order {order.order_number}</h1>

      <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Update status</h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_FLOW.map((s) => {
            const needsPaymentConfirm = s === "confirmed" && order.payment_method === "upi" && order.payment_status !== "paid";
            return (
              <button
                key={s}
                disabled={updating}
                onClick={() => handleStatusChange(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize disabled:opacity-50 ${
                  order.status === s ? "bg-rose-900 text-white" : "border border-stone-300 text-stone-600"
                }`}
              >
                {s}
                {needsPaymentConfirm && " · confirm UPI payment"}
              </button>
            );
          })}
          <button
            disabled={updating}
            onClick={() => handleStatusChange("cancelled")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
              order.status === "cancelled" ? "bg-rose-700 text-white" : "border border-rose-300 text-rose-600"
            }`}
          >
            Cancelled
          </button>
        </div>
      </div>

      {order.status !== "cancelled" && order.status !== "pending" && (
        <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-stone-900">Shipping &amp; tracking</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={ship.courier_name} onChange={(e) => setShip({ ...ship, courier_name: e.target.value })} placeholder="Courier (e.g. Delhivery)" maxLength={60} className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none" />
            <input value={ship.tracking_number} onChange={(e) => setShip({ ...ship, tracking_number: e.target.value })} placeholder="Tracking number" maxLength={60} className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none" />
            <input value={ship.tracking_url} onChange={(e) => setShip({ ...ship, tracking_url: e.target.value })} placeholder="Tracking link (optional, https://…)" maxLength={300} className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none sm:col-span-2" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {order.status === "shipped" || order.status === "delivered" ? (
              <>
                <button disabled={shipBusy} onClick={() => handleShipping("save")} className="rounded-full border border-stone-300 px-4 py-2 text-xs font-medium text-stone-700 disabled:opacity-50">Save details</button>
                <button disabled={shipBusy} onClick={() => handleShipping("ship")} className="rounded-full bg-rose-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50">Save &amp; email customer again</button>
              </>
            ) : (
              <button disabled={shipBusy} onClick={() => handleShipping("ship")} className="rounded-full bg-rose-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50">
                {shipBusy ? "Saving…" : "Mark shipped & email customer"}
              </button>
            )}
          </div>
          {order.shipped_at && <p className="mt-2 text-xs text-stone-400">Shipped on {new Date(order.shipped_at).toLocaleString("en-IN")}</p>}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Items</h2>
        <div className="space-y-3">
          {order.items?.map((item) => (
            <div key={item.id} className="flex gap-3 text-sm">
              <div className="h-16 w-14 flex-shrink-0 overflow-hidden rounded bg-stone-100">
                {item.image_url && <img src={item.image_url} className="h-full w-full object-cover" alt="" />}
              </div>
              <div className="flex-1">
                <p className="text-stone-800">{item.product_name}</p>
                <p className="text-xs text-stone-400">
                  {item.color} · SKU {item.sku} · Qty {item.quantity}
                </p>
              </div>
              <p className="font-medium text-stone-900">{formatINR(item.line_total)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-stone-900">Customer</h2>
          <p className="text-sm text-stone-600">
            {order.full_name}
            <br />
            {order.mobile}
            <br />
            {order.email}
          </p>
          <p className="mt-2 text-sm text-stone-600">
            {order.address_line1}
            {order.address_line2 ? `, ${order.address_line2}` : ""}
            <br />
            {order.city}, {order.state} {order.pincode}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-stone-900">Payment</h2>
          <p className="text-sm capitalize text-stone-600">Method: {order.payment_method}</p>
          <p className="text-sm capitalize text-stone-600">
            Status: {order.payment_status}
            {order.payment_method === "upi" && order.payment_status !== "paid" && (
              <span className="ml-2 text-xs normal-case text-stone-400">
                (click "confirmed" above once you've checked your UPI app)
              </span>
            )}
          </p>
          {order.payment_method === "upi" && (
            <p className={`mt-2 rounded-lg p-2 text-sm ${order.payment_reference ? "bg-emerald-50 text-emerald-800" : "bg-stone-50 text-stone-500"}`}>
              {order.payment_reference ? (
                <>
                  Customer's UTR: <span className="font-semibold">{order.payment_reference}</span>
                  {order.payment_reference_at && (
                    <span className="ml-1 text-xs">({new Date(order.payment_reference_at).toLocaleString("en-IN")})</span>
                  )}
                  {order.status === "cancelled" && order.payment_status !== "paid" && (
                    <span className="mt-1 block text-xs font-medium text-rose-700">
                      This order is cancelled but the customer sent a UTR. Check your UPI app; if the money is there, re-open the order.
                    </span>
                  )}
                </>
              ) : (
                "Customer has not sent a UTR yet."
              )}
            </p>
          )}
          <div className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatINR(order.subtotal)}</span>
            </div>
            {Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Coupon{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
                <span>− {formatINR(Number(order.discount_amount))}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>{formatINR(order.shipping_fee)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatINR(order.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
