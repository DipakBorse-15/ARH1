import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { MainLayout } from "@/layouts/MainLayout";
import { AdminLayout } from "@/layouts/AdminLayout";
import { ProtectedRoute, AdminRoute } from "@/routes/ProtectedRoute";
import { LoadingState } from "@/components/ui/States";
import { siteConfig } from "@/config/site";
import { ProductListingPage } from "@/pages/ProductListingPage";

import Home from "@/pages/Home";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import CartPage from "@/pages/CartPage";
import NotFoundPage from "@/pages/NotFoundPage";

const ProductPage = lazy(() => import("@/pages/ProductPage"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const OrderConfirmationPage = lazy(() => import("@/pages/OrderConfirmationPage"));
const AccountPage = lazy(() => import("@/pages/account/AccountPage"));
const OrdersPage = lazy(() => import("@/pages/account/OrdersPage"));
const OrderDetailPage = lazy(() => import("@/pages/account/OrderDetailPage"));
const AddressesPage = lazy(() => import("@/pages/account/AddressesPage"));

const AdminDashboardPage = lazy(() => import("@/pages/admin/DashboardPage"));
const AdminProductsPage = lazy(() => import("@/pages/admin/ProductsPage"));
const AdminProductFormPage = lazy(() => import("@/pages/admin/ProductFormPage"));
const AdminCategoriesPage = lazy(() => import("@/pages/admin/CategoriesPage"));
const AdminCollectionsPage = lazy(() => import("@/pages/admin/CollectionsPage"));
const AdminOrdersPage = lazy(() => import("@/pages/admin/OrdersPage"));
const AdminImportPage = lazy(() => import("@/pages/admin/ImportPage"));
const AdminOrderDetailPage = lazy(() => import("@/pages/admin/OrderDetailPage"));

// Normalize basename: BrowserRouter expects no trailing slash (except root "/").
const basename = siteConfig.basePath === "/" ? "/" : siteConfig.basePath.replace(/\/$/, "");

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <Suspense fallback={<LoadingState label="Loading AARAAH…" />}>
              <Routes>
                <Route element={<MainLayout />}>
                  <Route index element={<Home />} />
                  <Route path="category/:slug" element={<ProductListingPage mode="category" />} />
                  <Route path="collection/:slug" element={<ProductListingPage mode="collection" />} />
                  <Route path="search" element={<ProductListingPage mode="search" />} />
                  <Route path="products/:slug" element={<ProductPage />} />
                  <Route path="cart" element={<CartPage />} />
                  <Route path="login" element={<LoginPage />} />
                  <Route path="register" element={<RegisterPage />} />

                  <Route element={<ProtectedRoute />}>
                    <Route path="checkout" element={<CheckoutPage />} />
                    <Route path="order-confirmation/:orderId" element={<OrderConfirmationPage />} />
                    <Route path="account" element={<AccountPage />} />
                    <Route path="account/orders" element={<OrdersPage />} />
                    <Route path="account/orders/:orderId" element={<OrderDetailPage />} />
                    <Route path="account/addresses" element={<AddressesPage />} />
                  </Route>

                  <Route path="*" element={<NotFoundPage />} />
                </Route>

                <Route element={<AdminRoute />}>
                  <Route path="admin" element={<AdminLayout />}>
                    <Route index element={<AdminDashboardPage />} />
                    <Route path="products" element={<AdminProductsPage />} />
                    <Route path="products/new" element={<AdminProductFormPage />} />
                    <Route path="products/:id" element={<AdminProductFormPage />} />
                    <Route path="import" element={<AdminImportPage />} />
                    <Route path="categories" element={<AdminCategoriesPage />} />
                    <Route path="collections" element={<AdminCollectionsPage />} />
                    <Route path="orders" element={<AdminOrdersPage />} />
                    <Route path="orders/:orderId" element={<AdminOrderDetailPage />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
