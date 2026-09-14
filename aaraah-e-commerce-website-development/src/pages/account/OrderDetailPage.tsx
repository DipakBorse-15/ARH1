import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { formatINR } from "@/components/product/PriceDisplay";
import { fetchOrderById } from "@/services/orders";
import { friendlyError } from "@/lib/supabase";
import type { Order } from "@/types";

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    fetchOrderById(orderId)
      .then((o) => setOrder(o))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!order) return <ErrorState message="Order not found." />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <SEO title={`Order ${order.order_number}`} canonicalPath={`/account/orders/${order.id}`} />
      <Link to="/account/orders" className="text-sm text-rose-900 hover:underline">
        ← Back to orders
      </Link>
      <h1 className="mt-2 mb-1 font-serif text-2xl font-semibold text-stone-900">Order {order.order_number}</h1>
      <p className="mb-6 text-sm text-stone-500">
        Placed on {new Date(order.created_at).toLocaleString("en-IN")} · Status:{" "}
        <span className="font-medium capitalize text-stone-800">{order.status}</span>
      </p>

      <div className="mb-6 rounded-2xl border border-stone-200 p-5">
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

      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 p-5">
          <h2 className="mb-2 text-sm font-semibold text-stone-900">Shipping Address</h2>
          <p className="text-sm text-stone-600">
            {order.full_name}
            <br />
            {order.address_line1}
            {order.address_line2 ? `, ${order.address_line2}` : ""}
            <br />
            {order.city}, {order.state} {order.pincode}
            <br />
            {order.mobile}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 p-5">
          <h2 className="mb-2 text-sm font-semibold text-stone-900">Payment</h2>
          <p className="text-sm text-stone-600 capitalize">Method: {order.payment_method}</p>
          <p className="text-sm text-stone-600 capitalize">Status: {order.payment_status}</p>
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
