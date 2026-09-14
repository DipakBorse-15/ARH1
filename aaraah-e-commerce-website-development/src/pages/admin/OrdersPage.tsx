import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { formatINR } from "@/components/product/PriceDisplay";
import { useToast } from "@/contexts/ToastContext";
import { fetchAllOrdersAdmin } from "@/services/orders";
import { friendlyError } from "@/lib/supabase";
import type { Order, OrderStatus } from "@/types";

const STATUS_OPTIONS: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

export default function AdminOrdersPage() {
  const { show } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      setOrders(await fetchAllOrdersAdmin());
    } catch (err) {
      show(friendlyError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  const filtered = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);

  return (
    <div>
      <SEO title="Manage Orders" canonicalPath="/admin/orders" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold text-stone-900">Orders</h1>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-full border border-stone-300 px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading && <LoadingState />}
      {!loading && filtered.length === 0 && <EmptyState title="No orders found" />}

      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="p-3">Order #</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Date</th>
                <th className="p-3">Total</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-stone-100">
                  <td className="p-3 font-medium text-stone-800">{o.order_number}</td>
                  <td className="p-3 text-stone-500">{o.full_name}</td>
                  <td className="p-3 text-stone-500">{new Date(o.created_at).toLocaleDateString("en-IN")}</td>
                  <td className="p-3 font-medium text-stone-800">{formatINR(o.total)}</td>
                  <td className="p-3 capitalize text-stone-500">{o.payment_status}</td>
                  <td className="p-3 capitalize text-stone-500">{o.status}</td>
                  <td className="p-3">
                    <Link to={`/admin/orders/${o.id}`} className="text-rose-900 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
