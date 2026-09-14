import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { formatINR } from "@/components/product/PriceDisplay";
import { useToast } from "@/contexts/ToastContext";
import { fetchOrderById, updateOrderStatus } from "@/services/orders";
import { friendlyError } from "@/lib/supabase";
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

  async function handleStatusChange(status: OrderStatus) {
    if (!order) return;
    setUpdating(true);
    try {
      await updateOrderStatus(order.id, status);
      setOrder({ ...order, status });
      show("Order status updated", "success");
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setUpdating(false);
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
          {STATUS_FLOW.map((s) => (
            <button
              key={s}
              disabled={updating}
              onClick={() => handleStatusChange(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${
                order.status === s ? "bg-rose-900 text-white" : "border border-stone-300 text-stone-600"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            disabled={updating}
            onClick={() => handleStatusChange("cancelled")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
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
          <p className="text-sm capitalize text-stone-600">Status: {order.payment_status}</p>
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
