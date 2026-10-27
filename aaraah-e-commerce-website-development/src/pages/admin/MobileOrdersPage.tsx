import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/States";
import { formatINR } from "@/components/product/PriceDisplay";
import { PaymentBadge, StatusBadge, formatWhen } from "@/components/admin/orderUi";
import { fetchOrdersPageAdmin, type OrderListRow } from "@/services/adminOrders";
import { isExpiredUnpaid } from "@/services/orders";
import { friendlyError } from "@/lib/supabase";
import type { OrderStatus } from "@/types";

const FILTERS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

// When the app comes back to the front after this long, the list refreshes by itself.
const AUTO_REFRESH_MS = 30_000;

/** Phone Orders list: newest first, status filter, search, 20 at a time. */
export default function MobileOrdersPage() {
  const [rows, setRows] = useState<OrderListRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every request gets a number; a slow old answer can never replace a newer one.
  const requestId = useRef(0);
  const loadedAt = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      const id = ++requestId.current;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const page = await fetchOrdersPageAdmin({ status, search });
        if (id !== requestId.current) return;
        setRows(page.rows);
        setHasMore(page.hasMore);
        loadedAt.current = Date.now();
      } catch (err) {
        if (id !== requestId.current) return;
        // A silent refresh that fails keeps the list that is already on screen.
        if (!silent) setError(friendlyError(err, "Orders load nahi ho paye. Internet check karo."));
      } finally {
        if (id === requestId.current && !silent) setLoading(false);
      }
    },
    [status, search]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Search runs half a second after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Back to the app after a while -> refresh quietly.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && Date.now() - loadedAt.current > AUTO_REFRESH_MS) void load(true);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  async function loadMore() {
    const last = rows[rows.length - 1];
    if (!last || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const page = await fetchOrdersPageAdmin({ status, search, before: last.created_at });
      if (id !== requestId.current) return; // filter changed meanwhile
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.rows.filter((r) => !seen.has(r.id))];
      });
      setHasMore(page.hasMore);
    } catch (err) {
      setError(friendlyError(err, "Aur orders load nahi ho paye."));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <SEO title="Orders" canonicalPath="/admin/orders" />

      <div className="mb-3 flex items-center gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Order no., name or mobile"
          aria-label="Search orders"
          className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-base focus:border-rose-900 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-rose-900 active:bg-stone-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Filter chips scroll sideways inside their own row (the page itself never scrolls sideways). */}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatus(f.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
              status === f.value ? "bg-rose-900 text-white" : "border border-stone-300 bg-white text-stone-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <LoadingState label="Loading orders…" />}
      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState title="No orders found" message={search || status !== "all" ? "Filter ya search badal ke dekho." : "Abhi tak koi order nahi aaya."} />
      )}

      {!loading && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((o) => {
            const qty = (o.items || []).reduce((s, i) => s + i.quantity, 0);
            return (
              <li key={o.id}>
                <Link
                  to={`/admin/orders/${o.id}`}
                  className="block rounded-2xl border border-stone-200 bg-white p-4 active:bg-stone-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-900">{o.order_number}</p>
                      <p className="text-xs text-stone-500">{formatWhen(o.created_at)}</p>
                    </div>
                    <p className="shrink-0 text-base font-semibold text-stone-900">{formatINR(Number(o.total))}</p>
                  </div>
                  <p className="mt-2 truncate text-sm text-stone-700">
                    {o.full_name} · {qty} item{qty === 1 ? "" : "s"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={o.status} />
                    <PaymentBadge status={o.payment_status} method={o.payment_method} />
                    {o.payment_status !== "paid" && o.payment_reference && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">UTR sent</span>
                    )}
                    {isExpiredUnpaid(o) && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Expired</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && hasMore && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="mt-4 w-full rounded-full border border-rose-900 bg-white py-3 text-sm font-semibold text-rose-900 active:bg-rose-50 disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
