import { useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { formatINR } from "@/components/product/PriceDisplay";
import { UpiPaymentCard } from "@/components/payment/UpiPaymentCard";
import { useLiveOrder } from "@/hooks/useLiveOrder";
import { trackPurchase } from "@/lib/analytics";

export default function OrderConfirmationPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const orderNumber = (location.state as { orderNumber?: string } | null)?.orderNumber;
  const { order, loading, error, refetch } = useLiveOrder(orderId);

  // Analytics: once per order, as soon as the order has loaded.
  const orderForTracking = order;
  useEffect(() => {
    if (!orderForTracking || orderForTracking.status === "cancelled") return;
    trackPurchase(
      orderForTracking.order_number,
      orderForTracking.total,
      (orderForTracking.items || []).map((i) => ({ id: i.sku, name: i.product_name, variant: i.color, price: i.unit_price, quantity: i.quantity }))
    );
  }, [orderForTracking]);

  if (loading) return <LoadingState label="Loading your order…" />;
  if (error) return <ErrorState message={error} />;

  const shownNumber = order?.order_number || orderNumber;
  const isCancelled = order?.status === "cancelled";
  // Paid UPI orders (or cash-on-delivery, which is confirmed at once) get the thank-you; an unpaid UPI order waits.
  const isPaid = !!order && (order.payment_status === "paid" || order.payment_method === "cod");

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <SEO title="Your Order" canonicalPath="/order-confirmation" />
      {isCancelled ? (
        <>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-3xl text-stone-600">✕</div>
          <h1 className="font-serif text-3xl font-semibold text-stone-900">Order cancelled</h1>
          <p className="mt-2 text-stone-500">
            Order <span className="font-semibold text-stone-800">{shownNumber}</span> has been cancelled. If you had already paid, we will contact you about the refund.
          </p>
        </>
      ) : isPaid ? (
        <>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">✓</div>
          <h1 className="font-serif text-3xl font-semibold text-stone-900">Thank you for your order!</h1>
          <p className="mt-2 text-stone-500">
            Order <span className="font-semibold text-stone-800">{shownNumber}</span> is confirmed.
          </p>
        </>
      ) : (
        <>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-3xl">⏳</div>
          <h1 className="font-serif text-3xl font-semibold text-stone-900">Order placed</h1>
          <p className="mt-2 text-stone-500">
            Order <span className="font-semibold text-stone-800">{shownNumber}</span> is waiting for payment confirmation.
          </p>
          <p className="mt-2 text-sm font-semibold text-amber-800">Please do not refresh or close this page. It updates by itself once your payment is confirmed.</p>
        </>
      )}

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

      {order && <UpiPaymentCard order={order} onSubmitted={refetch} />}

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
