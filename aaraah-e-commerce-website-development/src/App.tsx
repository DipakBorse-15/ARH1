import { WishlistProvider } from "@/contexts/WishlistContext";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { SiteSettingsProvider } from "@/contexts/SiteSettingsContext";
import { MainLayout } from "@/layouts/MainLayout";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { Analytics } from "@/components/layout/Analytics";
import { AdminLayout } from "@/layouts/AdminLayout";
import { ProtectedRoute, AdminRoute } from "@/routes/ProtectedRoute";
import { LoadingState } from "@/components/ui/States";
import { siteConfig } from "@/config/site";
import { ProductListingPage } from "@/pages/ProductListingPage";
import CategoryPage from "@/pages/CategoryPage";

import Home from "@/pages/Home";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import CartPage from "@/pages/CartPage";
import NotFoundPage from "@/pages/NotFoundPage";

const LegalPage = lazy(() => import("@/pages/LegalPage"));
const InfoPage = lazy(() => import("@/pages/InfoPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const ProductPage = lazy(() => import("@/pages/ProductPage"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const OrderConfirmationPage = lazy(() => import("@/pages/OrderConfirmationPage"));
const AccountPage = lazy(() => import("@/pages/account/AccountPage"));
const OrdersPage = lazy(() => import("@/pages/account/OrdersPage"));
const OrderDetailPage = lazy(() => import("@/pages/account/OrderDetailPage"));
const AddressesPage = lazy(() => import("@/pages/account/AddressesPage"));

const AdminLoginPage = lazy(() => import("@/pages/admin/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("@/pages/admin/DashboardPage"));
const AdminProductsPage = lazy(() => import("@/pages/admin/ProductsPage"));
const AdminProductFormPage = lazy(() => import("@/pages/admin/ProductFormPage"));
const AdminNewListingPage = lazy(() => import("@/pages/admin/NewListingPage"));
const AdminSeoCheckPage = lazy(() => import("@/pages/admin/SeoCheckPage"));
const AdminPhotoOptimizerPage = lazy(() => import("@/pages/admin/PhotoOptimizerPage"));
const AdminCategoriesPage = lazy(() => import("@/pages/admin/CategoriesPage"));
const AdminCollectionsPage = lazy(() => import("@/pages/admin/CollectionsPage"));
const AdminOrdersPage = lazy(() => import("@/pages/admin/OrdersPage"));
const AdminImportPage = lazy(() => import("@/pages/admin/ImportPage"));
const AdminHomeEditorPage = lazy(() => import("@/pages/admin/HomeEditorPage"));
const WishlistPage = lazy(() => import("@/pages/account/WishlistPage"));
const AdminCouponsPage = lazy(() => import("@/pages/admin/CouponsPage"));
const AdminReviewsPage = lazy(() => import("@/pages/admin/ReviewsPage"));
const AdminOrderDetailPage = lazy(() => import("@/pages/admin/OrderDetailPage"));

// Normalize basename: BrowserRouter expects no trailing slash (except root "/").
const basename = siteConfig.basePath === "/" ? "/" : siteConfig.basePath.replace(/\/$/, "");

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <ToastProvider>
        <SiteSettingsProvider>
        <AuthProvider>
          <CartProvider>
          <WishlistProvider>
            <ScrollToTop />
            <Analytics />
            <Suspense fallback={<LoadingState label="Loading AARAAH…" />}>
              <Routes>
                <Route element={<MainLayout />}>
                  <Route index element={<Home />} />
                  <Route path="category/:slug" element={<CategoryPage />} />
                  <Route path="category/:slug/all" element={<ProductListingPage mode="category" />} />
                  <Route path="collection/:slug" element={<ProductListingPage mode="collection" />} />
                  <Route path="search" element={<ProductListingPage mode="search" />} />
                  <Route path="products/:slug" element={<ProductPage />} />
                  <Route path="cart" element={<CartPage />} />
                  <Route path="login" element={<LoginPage />} />
                  <Route path="register" element={<RegisterPage />} />
                  <Route path="forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="reset-password" element={<ResetPasswordPage />} />
                  <Route path="about" element={<InfoPage doc="about" />} />
                  <Route path="contact" element={<InfoPage doc="contact" />} />
                  <Route path="faq" element={<InfoPage doc="faq" />} />
                  <Route path="privacy-policy" element={<LegalPage doc="privacy" />} />
                  <Route path="terms-and-conditions" element={<LegalPage doc="terms" />} />
                  <Route path="returns-and-refunds" element={<LegalPage doc="returns" />} />
                  <Route path="shipping-policy" element={<LegalPage doc="shipping" />} />

                  <Route element={<ProtectedRoute />}>
                    <Route path="checkout" element={<CheckoutPage />} />
                    <Route path="order-confirmation/:orderId" element={<OrderConfirmationPage />} />
                    <Route path="account" element={<AccountPage />} />
                    <Route path="account/orders" element={<OrdersPage />} />
                    <Route path="account/orders/:orderId" element={<OrderDetailPage />} />
                    <Route path="account/wishlist" element={<WishlistPage />} />
                    <Route path="account/addresses" element={<AddressesPage />} />
                  </Route>

                  <Route path="*" element={<NotFoundPage />} />
                </Route>

                <Route path="admin/login" element={<AdminLoginPage />} />

                <Route element={<AdminRoute />}>
                  <Route path="admin" element={<AdminLayout />}>
                    <Route index element={<AdminDashboardPage />} />
                    <Route path="products" element={<AdminProductsPage />} />
                    <Route path="products/new" element={<AdminNewListingPage />} />
                    <Route path="seo-check" element={<AdminSeoCheckPage />} />
                    <Route path="photo-optimizer" element={<AdminPhotoOptimizerPage />} />
                    <Route path="products/:id" element={<AdminProductFormPage />} />
                    <Route path="import" element={<AdminImportPage />} />
                    <Route path="home-editor" element={<AdminHomeEditorPage />} />
                    <Route path="hero-slides" element={<Navigate to="/admin/home-editor" replace />} />
                    <Route path="categories" element={<AdminCategoriesPage />} />
                    <Route path="collections" element={<AdminCollectionsPage />} />
                    <Route path="orders" element={<AdminOrdersPage />} />
                    <Route path="coupons" element={<AdminCouponsPage />} />
                    <Route path="reviews" element={<AdminReviewsPage />} />
                    <Route path="orders/:orderId" element={<AdminOrderDetailPage />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </WishlistProvider>
          </CartProvider>
        </AuthProvider>
        </SiteSettingsProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
