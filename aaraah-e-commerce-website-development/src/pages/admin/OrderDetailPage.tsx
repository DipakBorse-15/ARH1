import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { formatINR } from "@/components/product/PriceDisplay";
import { useToast } from "@/contexts/ToastContext";
import { fetchOrderById, updateOrderPaymentStatus, updateOrderStatus } from "@/services/orders";
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

  useEffect(() => {
    if (orderId) load(orderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function load(id: string) {
    setLoading(true);
    setError(null);
    try {
      setOrder(await fetchOrderById(id));
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
        await updateOrderStatus(order.id, status);
        setOrder({ ...order, status });
        show("Order status updated", "success");
      }
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setUpdating(false);
    }
  }

  // Fire-and-forget: a failed email shouldn't undo the payment confirmation
  // that already succeeded, so this only ever shows a soft warning toast.
  async function sendPaymentConfirmedEmail(id: string) {
    try {
      const { error } = await supabase.functions.invoke("send-payment-confirmed-email", { body: { order_id: id } });
      if (error) throw error;
    } catch {
      show("Payment confirmed, but the email couldn't be sent.", "error");
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
          <div className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatINR(order.subtotal)}</span>
            </div>
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
