import { supabase } from "@/lib/supabase";
import type { DashboardStats } from "@/types";

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [
    { count: totalProducts },
    { count: activeProducts },
    { count: totalOrders },
    { count: pendingOrders },
    { count: deliveredOrders },
    { count: totalCustomers },
    { count: lowStockVariants },
    { data: paidOrders },
  ] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "delivered"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
    supabase.from("product_variants").select("id", { count: "exact", head: true }).lte("stock_quantity", 5).eq("active", true),
    supabase.from("orders").select("total").eq("payment_status", "paid"),
  ]);

  const totalSales = (paidOrders || []).reduce((sum, o: { total: number }) => sum + Number(o.total), 0);

  return {
    totalProducts: totalProducts || 0,
    activeProducts: activeProducts || 0,
    totalOrders: totalOrders || 0,
    pendingOrders: pendingOrders || 0,
    deliveredOrders: deliveredOrders || 0,
    totalCustomers: totalCustomers || 0,
    lowStockVariants: lowStockVariants || 0,
    totalSales,
  };
}
