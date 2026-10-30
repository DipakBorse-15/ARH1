import { lazy, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsMobile } from "@/lib/useIsMobile";

// Phone and laptop get different Orders screens; the laptop ones are the original, untouched pages.
const DashboardPage = lazy(() => import("@/pages/admin/DashboardPage"));
const DesktopOrdersPage = lazy(() => import("@/pages/admin/OrdersPage"));
const DesktopOrderDetailPage = lazy(() => import("@/pages/admin/OrderDetailPage"));
const MobileOrdersPage = lazy(() => import("@/pages/admin/MobileOrdersPage"));
const MobileOrderDetailPage = lazy(() => import("@/pages/admin/MobileOrderDetailPage"));
const DesktopProductsPage = lazy(() => import("@/pages/admin/ProductsPage"));
const MobileProductsPage = lazy(() => import("@/pages/admin/MobileProductsPage"));

/** /admin: phone opens straight on Orders; laptop shows the Dashboard as before. */
export function AdminIndexRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <Navigate to="/admin/orders" replace /> : <DashboardPage />;
}

export function AdminOrdersRoute() {
  return useIsMobile() ? <MobileOrdersPage /> : <DesktopOrdersPage />;
}

export function AdminOrderDetailRoute() {
  return useIsMobile() ? <MobileOrderDetailPage /> : <DesktopOrderDetailPage />;
}

/** Products: phone = only MRP / selling price / stock; laptop = the full page, unchanged. */
export function AdminProductsRoute() {
  return useIsMobile() ? <MobileProductsPage /> : <DesktopProductsPage />;
}

/**
 * Listing pages (new product, product edit form with publish/delete, Excel import) are laptop-only.
 * On a phone, even a typed or bookmarked address just goes back to the Products tab.
 */
export function LaptopOnly({ children }: { children: ReactNode }) {
  return useIsMobile() ? <Navigate to="/admin/products" replace /> : <>{children}</>;
}
