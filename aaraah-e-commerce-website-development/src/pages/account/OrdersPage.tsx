import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { AccountNav } from "@/components/account/AccountNav";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { formatINR } from "@/components/product/PriceDisplay";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMyOrders } from "@/services/orders";
import { friendlyError } from "@/lib/supabase";
import type { Order } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-sky-50 text-sky-700",
  processing: "bg-indigo-50 text-indigo-700",
  shipped: "bg-purple-50 text-purple-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-rose-50 text-rose-700",
};

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setOrders(await fetchMyOrders(user.id));
    } catch (err) {
      setError(friendlyError(err, "Could not load your orders."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <SEO title="My Orders" canonicalPath="/account/orders" />
      <h1 className="mb-4 font-serif text-3xl font-semibold text-stone-900">My Account</h1>
      <AccountNav />

      {loading && <LoadingState label="Loading your orders…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && orders.length === 0 && (
        <EmptyState
          title="No orders yet"
          message="Once you place an order, it will show up here."
          action={
            <Link to="/" className="rounded-full bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white">
              Start shopping
            </Link>
          }
        />
      )}

      <div className="space-y-3">
        {orders.map((o) => (
          <Link
            key={o.id}
            to={`/account/orders/${o.id}`}
            className="flex items-center justify-between rounded-xl border border-stone-200 p-4 transition hover:shadow-sm"
          >
            <div>
              <p className="text-sm font-semibold text-stone-900">{o.order_number}</p>
              <p className="text-xs text-stone-500">{new Date(o.created_at).toLocaleDateString("en-IN")}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-stone-900">{formatINR(o.total)}</p>
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[o.status]}`}>
                {o.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
