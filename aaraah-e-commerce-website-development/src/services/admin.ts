import { supabase } from "@/lib/supabase";
import type { DashboardStats } from "@/types";

export async function fetchDashboardStats(): Promise<DashboardStats> {
  // After "Reset orders" the customer count starts again from that moment.
  const { data: settingsRow } = await supabase.from("site_settings").select("stats_reset_at").eq("id", true).maybeSingle();
  const resetAt = (settingsRow as { stats_reset_at?: string | null } | null)?.stats_reset_at ?? null;
  let customersQuery = supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer");
  if (resetAt) customersQuery = customersQuery.gt("created_at", resetAt);

  const [
    { count: totalProducts },
    { count: activeProducts },
    { count: totalVariants },
    { count: activeVariants },
    { count: totalOrders },
    { count: pendingOrders },
    { count: deliveredOrders },
    { count: totalCustomers },
    { count: lowStockVariants },
    { data: paidOrders },
  ] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("product_variants").select("id", { count: "exact", head: true }),
    supabase.from("product_variants").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "delivered"),
    customersQuery,
    supabase.from("product_variants").select("id", { count: "exact", head: true }).lte("stock_quantity", 5).eq("active", true),
    supabase.from("orders").select("total").eq("payment_status", "paid"),
  ]);

  const totalSales = (paidOrders || []).reduce((sum, o: { total: number }) => sum + Number(o.total), 0);

  return {
    totalProducts: totalProducts || 0,
    activeProducts: activeProducts || 0,
    totalVariants: totalVariants || 0,
    activeVariants: activeVariants || 0,
    totalOrders: totalOrders || 0,
    pendingOrders: pendingOrders || 0,
    deliveredOrders: deliveredOrders || 0,
    totalCustomers: totalCustomers || 0,
    lowStockVariants: lowStockVariants || 0,
    totalSales,
  };
}
