import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { formatINR } from "@/components/product/PriceDisplay";
import { fetchOrderById } from "@/services/orders";
import { friendlyError } from "@/lib/supabase";
import type { Order } from "@/types";

export default function OrderConfirmationPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const orderNumber = (location.state as { orderNumber?: string } | null)?.orderNumber;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    fetchOrderById(orderId)
      .then(setOrder)
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <LoadingState label="Confirming your order…" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <SEO title="Order Confirmed" canonicalPath="/order-confirmation" />
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">✓</div>
      <h1 className="font-serif text-3xl font-semibold text-stone-900">Thank you for your order!</h1>
      <p className="mt-2 text-stone-500">
        Order <span className="font-semibold text-stone-800">{order?.order_number || orderNumber}</span> has been placed successfully.
      </p>

      {order && (
        <div className="mt-8 rounded-2xl border border-stone-200 p-5 text-left">
          <div className="mb-3 flex justify-between text-sm">
            <span className="text-stone-500">Payment method</span>
            <span className="font-medium uppercase text-stone-800">{order.payment_method}</span>
          </div>
          <div className="mb-3 flex justify-between text-sm">
            <span className="text-stone-500">Status</span>
            <span className="font-medium capitalize text-stone-800">{order.status}</span>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-3 text-base font-semibold">
            <span>Total</span>
            <span>{formatINR(order.total)}</span>
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-center gap-3">
        <Link to="/account/orders" className="rounded-full bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white">
          View my orders
        </Link>
        <Link to="/" className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
