import { useEffect, useState } from "react";
import { SEO } from "@/components/ui/SEO";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { formatINR } from "@/components/product/PriceDisplay";
import { fetchDashboardStats } from "@/services/admin";
import { friendlyError } from "@/lib/supabase";
import type { DashboardStats } from "@/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setStats(await fetchDashboardStats());
    } catch (err) {
      setError(friendlyError(err, "Could not load dashboard stats."));
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingState label="Loading dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!stats) return null;

  const cards = [
    { label: "Product Designs", value: stats.totalProducts },
    { label: "Active Designs", value: stats.activeProducts },
    { label: "Total SKUs (Colours)", value: stats.totalVariants },
    { label: "Active SKUs (Colours)", value: stats.activeVariants },
    { label: "Total Orders", value: stats.totalOrders },
    { label: "Pending Orders", value: stats.pendingOrders },
    { label: "Delivered Orders", value: stats.deliveredOrders },
    { label: "Total Customers", value: stats.totalCustomers },
    { label: "Low Stock SKUs", value: stats.lowStockVariants, warn: stats.lowStockVariants > 0 },
    { label: "Total Sales (Paid)", value: formatINR(stats.totalSales) },
  ];

  return (
    <div>
      <SEO title="Admin Dashboard" canonicalPath="/admin" />
      <h1 className="mb-6 font-serif text-2xl font-semibold text-stone-900">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{c.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${c.warn ? "text-rose-600" : "text-stone-900"}`}>{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
