import { Link, useNavigate } from "react-router-dom";
import { SEO } from "@/components/ui/SEO";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { formatINR } from "@/components/product/PriceDisplay";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";

export default function CartPage() {
  const { items, loading, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  // Free shipping on every order (must match SHIPPING_FEE in create-order and CheckoutPage).
  const shipping = 0;

  function goToCheckout() {
    if (!user) {
      // Your items stay in the cart and move into your account when you sign in.
      navigate("/login", { state: { from: "/checkout" } });
      return;
    }
    navigate("/checkout");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <SEO title="Your Cart" canonicalPath="/cart" />
      <h1 className="mb-6 font-serif text-3xl font-semibold text-stone-900">Your Cart</h1>

      {loading && <LoadingState label="Loading your cart…" />}

      {!loading && items.length === 0 && (
        <EmptyState
          title="Your cart is empty"
          message="Explore our collections and add something beautiful."
          action={
            <Link to="/" className="rounded-full bg-rose-900 px-5 py-2.5 text-sm font-semibold text-white">
              Continue shopping
            </Link>
          }
        />
      )}

      {!loading && items.length > 0 && (
        <div className="grid gap-8 md:grid-cols-[1fr_320px]">
          <div>
            {items.map((item) => (
              <CartItemRow key={item.id} item={item} />
            ))}
          </div>
          <div className="h-fit rounded-2xl border border-stone-200 p-5">
            <h2 className="mb-4 font-semibold text-stone-900">Order Summary</h2>
            <div className="space-y-2 text-sm text-stone-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{shipping === 0 ? "Free" : formatINR(shipping)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-semibold text-stone-900">
                <span>Total</span>
                <span>{formatINR(subtotal + shipping)}</span>
              </div>
            </div>
            <button
              onClick={goToCheckout}
              className="mt-5 w-full rounded-full bg-rose-900 py-3 text-sm font-semibold text-white transition hover:bg-rose-800"
            >
              {user ? "Proceed to Checkout" : "Sign in to Checkout"}
            </button>
            {!user && (
              <p className="mt-2 text-center text-xs text-stone-500">Your cart is saved. Sign in or create an account to place the order.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
