import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { formatINR } from "@/components/product/PriceDisplay";
import { useToast } from "@/contexts/ToastContext";
import { CancelOrderError, cancelOrder, fetchOrderById, reopenOrderAdmin, saveShippingDetails, sendShippedEmail, updateOrderPaymentStatus, updateOrderStatus } from "@/services/orders";
import { markRefundedGuarded } from "@/services/adminOrders";
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
  const [command, setCommand] = useState("");

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
      if (order.status === "delivered" || order.status === "shipped") {
        show(`A ${order.status} order cannot be cancelled.`, "error");
        return;
      }
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

    // Status only moves forward: pending → confirmed → processing → shipped → delivered.
    const rank = (s: OrderStatus) => STATUS_FLOW.indexOf(s);
    if (order.status === "cancelled") {
      show("This order is cancelled. A cancelled order cannot be changed.", "error");
      return;
    }
    if (rank(status) <= rank(order.status)) {
      show(`This order is already "${order.status}". Status cannot go back.`, "error");
      return;
    }
    // Nothing ships (or is delivered) before the payment is confirmed.
    if ((status === "shipped" || status === "delivered") && order.payment_status !== "paid" && order.payment_method !== "cod") {
      show("Payment is not confirmed yet. Type \"confirm\" first.", "error");
      return;
    }

    // An online (Razorpay) order becomes confirmed + paid by itself when the money arrives. Confirming it by hand would
    // mean shipping without payment.
    if (status === "confirmed" && order.payment_method === "razorpay" && order.payment_status !== "paid") {
      show("Razorpay payment abhi nahi aaya. Paisa aate hi order apne aap Confirmed ho jata hai (30 minute me nahi aaya to cancel ho jata hai).", "error");
      return;
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
        // Delivered: thank-you + review request (soft failure only).
        if (status === "delivered") {
          sendShippedEmail(order.id, "delivered").then((ok) => {
            if (!ok) show("Marked delivered, but the review-request email couldn't be sent.", "error");
          });
        }
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

  // Status is changed by typing a word, so it cannot happen by an accidental click.
  const COMMANDS: Record<string, OrderStatus> = { confirm: "confirmed", process: "processing", delivered: "delivered", cancel: "cancelled" };
  async function runCommand(e: React.FormEvent) {
    e.preventDefault();
    const word = command.trim().toLowerCase();
    if (word === "reopen") {
      setCommand("");
      await handleReopen();
      return;
    }
    if (word === "refund" || word === "refunded") {
      setCommand("");
      await handleMarkRefunded();
      return;
    }
    if (order?.status === "cancelled") {
      show('Ye order cancelled hai. Sirf "reopen" ya "refunded" type kar sakte ho.', "error");
      return;
    }
    if (word === "shipped") {
      show("To ship an order, fill the courier details below and press \"Mark shipped & email customer\".", "error");
      return;
    }
    const target = COMMANDS[word];
    if (!target) {
      show("Type one of: confirm, process, delivered, cancel", "error");
      return;
    }
    setCommand("");
    await handleStatusChange(target);
  }

  // The money was given back to the customer (done in the Razorpay dashboard / UPI app): only record it here.
  // Same rule as the phone admin: only a PAID order that is cancelled / shipped / delivered can be marked refunded.
  async function handleMarkRefunded() {
    if (!order) return;
    if (order.payment_status === "refunded") {
      show("Ye order pehle se refunded mark hai.", "error");
      return;
    }
    if (order.payment_status !== "paid") {
      show("Sirf paid order refunded mark ho sakta hai.", "error");
      return;
    }
    if (order.status !== "cancelled" && order.status !== "shipped" && order.status !== "delivered") {
      show('Pehle order cancel karo (type "cancel"), phir refund mark karo.', "error");
      return;
    }
    const extra = order.status === "cancelled" ? "" : "\n\nDhyan do: return aaya maal ka stock apne aap nahi badhega. Products mein stock khud badhao.";
    if (!confirm(`Customer ko ₹${order.total} wapas de diya?\n\nPayment 'refunded' mark ho jayegi.${extra}`)) return;
    setUpdating(true);
    try {
      const ok = await markRefundedGuarded(order.id);
      if (!ok) {
        show("Order abhi kisi aur ne badal diya. Page refresh karke dobara dekho.", "error");
      } else {
        show("Payment refunded mark ho gayi", "success");
      }
      await load(order.id);
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setUpdating(false);
    }
  }

  // Cancelled -> confirmed + paid again (e.g. the customer paid after the auto-cancel). Stock is taken again.
  async function handleReopen() {
    if (!order) return;
    if (order.status !== "cancelled") {
      show('"reopen" sirf cancelled order par chalta hai.', "error");
      return;
    }
    if (order.payment_status === "refunded" || order.shipped_at) {
      show("Refunded ya shipped order dobara open nahi ho sakta.", "error");
      return;
    }
    if (order.payment_method === "razorpay" && order.payment_status !== "paid") {
      show("Is online order ka paisa nahi aaya. Agar customer ne late payment kar diya to order apne aap dobara khul jata hai (stock ho to).", "error");
      return;
    }
    if (!confirm(`Kya ₹${order.total} tumhare UPI app / bank me aa chuka hai?\n\nOK dabane par order dobara Confirmed + Paid ho jayega, stock wapas lagega aur customer ko "Payment received" email jayegi.`)) return;
    setUpdating(true);
    try {
      await reopenOrderAdmin(order.id);
      show("Order dobara khul gaya: Confirmed + Paid", "success");
      sendPaymentConfirmedEmail(order.id);
      await load(order.id);
    } catch (err) {
      show((err as Error).message || friendlyError(err), "error");
    } finally {
      setUpdating(false);
    }
  }

  // Courier + tracking. "Ship" also moves the order to shipped and emails the customer.
  async function handleShipping(mode: "ship" | "save" | "email") {
    if (!order) return;
    if (mode === "ship") {
      if (order.status === "shipped" || order.status === "delivered" || order.status === "cancelled" || order.status === "pending") {
        show(order.status === "pending" ? "Confirm the order first (type \"confirm\")." : `This order is already ${order.status}.`, "error");
        return;
      }
      if (order.payment_status !== "paid" && order.payment_method !== "cod") {
        show("Payment is not confirmed yet. Type \"confirm\" first.", "error");
        return;
      }
    }
    {
      if (mode === "ship" && !ship.courier_name.trim()) return show("Enter the courier name first (e.g. India Post, Delhivery).", "error");
      if (ship.tracking_url.trim() && !/^https?:\/\//i.test(ship.tracking_url.trim())) return show("Tracking link must start with http:// or https://", "error");
    }
    setShipBusy(true);
    try {
      {
        const patch = await saveShippingDetails(order.id, ship, mode === "ship");
        setOrder({ ...order, ...patch } as Order);
      }
      if (mode === "save") {
        show("Shipping details saved", "success");
      } else {
        const ok = await sendShippedEmail(order.id);
        if (ok) show(mode === "ship" ? "Marked shipped and customer emailed" : "Details saved and tracking email sent", "success");
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
        <ol className="mb-4 flex flex-wrap gap-2 text-xs">
          {STATUS_FLOW.map((s) => (
            <li key={s} className={`rounded-full px-3 py-1.5 font-medium capitalize ${order.status === s ? "bg-rose-900 text-white" : STATUS_FLOW.indexOf(s) < STATUS_FLOW.indexOf(order.status) ? "bg-stone-100 text-stone-400 line-through" : "border border-stone-300 text-stone-600"}`}>
              {s}
            </li>
          ))}
          <li className={`rounded-full px-3 py-1.5 font-medium ${order.status === "cancelled" ? "bg-rose-700 text-white" : "border border-rose-200 text-rose-400"}`}>Cancelled</li>
        </ol>
        {order.status === "delivered" ? (
          <p className="text-xs text-stone-500">This order is delivered. No more changes are possible.</p>
        ) : (
          <form onSubmit={runCommand} className="flex flex-wrap items-center gap-2">
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              disabled={updating}
              placeholder="Type a command"
              aria-label="Status command"
              autoComplete="off"
              className="w-48 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-900 focus:outline-none"
            />
            <button type="submit" disabled={updating || !command.trim()} className="rounded-full bg-rose-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
              Go
            </button>
            <p className="w-full text-xs text-stone-500">
              {order.status === "cancelled" ? (
                <>
                  <b>reopen</b> = order dobara Confirmed + Paid (stock wapas lagega, customer ko &quot;Payment received&quot; email). Pehle apna UPI app check karo, paisa aaya ho tabhi. <b>refunded</b> = customer ko paisa wapas de diya (Paid order ke liye).
                </>
              ) : (
                <>
                  <b>confirm</b> = confirmed{order.payment_method === "upi" && order.payment_status !== "paid" ? " (also marks the UPI payment received)" : ""} · <b>process</b> = processing · <b>delivered</b> = delivered · <b>cancel</b> = cancelled · <b>refunded</b> = paisa wapas de diya (cancelled / shipped / delivered paid order). Shipping: use the box below. Status can only move forward.
                </>
              )}
            </p>
          </form>
        )}
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
                <button disabled={shipBusy} onClick={() => handleShipping("email")} className="rounded-full bg-rose-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50">Save &amp; email tracking again</button>
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
          {order.payment_method === "razorpay" && (
            <p className={`mt-2 rounded-lg p-2 text-sm ${order.razorpay_payment_id ? "bg-emerald-50 text-emerald-800" : "bg-stone-50 text-stone-500"}`}>
              {order.razorpay_payment_id ? (
                <>
                  Razorpay payment: <span className="break-all font-semibold">{order.razorpay_payment_id}</span>
                  {order.paid_at && <span className="ml-1 text-xs">({new Date(order.paid_at).toLocaleString("en-IN")})</span>}
                  <span className="mt-1 block text-xs">Refund dena ho to Razorpay dashboard → Payments → ye payment kholo → Refund. Phir yahan Refund mark karo.</span>
                </>
              ) : (
                "Online payment abhi nahi aaya. Aate hi order apne aap Confirmed ho jayega."
              )}
            </p>
          )}
          {order.payment_status === "paid" && (order.status === "cancelled" || order.status === "shipped" || order.status === "delivered") && (
            <button
              type="button"
              onClick={() => void handleMarkRefunded()}
              disabled={updating}
              className="mt-3 rounded-full border border-rose-900 px-4 py-2 text-xs font-semibold text-rose-900 hover:bg-rose-50 disabled:opacity-40"
            >
              Payment refunded (mark)
            </button>
          )}
          {order.payment_status === "refunded" && <p className="mt-2 text-xs font-medium text-stone-500">Refund ho chuka hai (mark kiya hua).</p>}
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
